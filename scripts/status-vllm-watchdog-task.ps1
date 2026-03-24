param(
  [string]$TaskName = "KnexIT-vLLM-Watchdog"
)

$ErrorActionPreference = "Stop"
$hasNativePreference = Test-Path variable:PSNativeCommandUseErrorActionPreference
if ($hasNativePreference) {
  $previousNativePreference = $PSNativeCommandUseErrorActionPreference
}

function Invoke-SchtasksQueryOutput {
  param(
    [string]$Name
  )

  try {
    $previousErrorActionPreference = $ErrorActionPreference
    $script:ErrorActionPreference = "Continue"
    if ($hasNativePreference) {
      $script:PSNativeCommandUseErrorActionPreference = $false
    }
    $output = & schtasks.exe /Query /TN $Name /FO LIST /V 2>&1
    $exitCode = $LASTEXITCODE
    return @{
      Output = $output
      ExitCode = $exitCode
    }
  } finally {
    $script:ErrorActionPreference = $previousErrorActionPreference
    if ($hasNativePreference) {
      $script:PSNativeCommandUseErrorActionPreference = $previousNativePreference
    }
  }
}

try {
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  $info = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction Stop
  Write-Host "task=present name=$TaskName state=$($task.State) lastRun=$($info.LastRunTime) nextRun=$($info.NextRunTime) lastResult=$($info.LastTaskResult)"
  exit 0
} catch {
  $query = Invoke-SchtasksQueryOutput -Name $TaskName
  if ($query.ExitCode -ne 0) {
    Write-Host "task=missing name=$TaskName"
    exit 1
  }

  $state = (($query.Output | Select-String -Pattern "Status:", "Estado de tarefa agendada:" | Select-Object -First 1).ToString() -split ":\s*", 2)[-1]
  $lastResult = (($query.Output | Select-String -Pattern "Last Result:", "Ultimo resultado:", "Último resultado:" | Select-Object -First 1).ToString() -split ":\s*", 2)[-1]
  if (-not $state) { $state = "unknown" }
  if (-not $lastResult) { $lastResult = "unknown" }
  Write-Host "task=present name=$TaskName state=$state lastResult=$lastResult source=schtasks"
  exit 0
}
