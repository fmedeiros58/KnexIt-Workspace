param(
  [string]$TaskName = "KnexIT-Backends-Watchdog"
)

$ErrorActionPreference = "Stop"
$hasNativePreference = Test-Path variable:PSNativeCommandUseErrorActionPreference
if ($hasNativePreference) {
  $previousNativePreference = $PSNativeCommandUseErrorActionPreference
}

$deprecatedTaskNames = @("KnexIT-vLLM-Watchdog", "KnexIT-ANM-Watchdog")

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

function Test-TaskExists {
  param(
    [string]$Name
  )
  try {
    [void](Get-ScheduledTask -TaskName $Name -ErrorAction Stop)
    return $true
  } catch {
    $query = Invoke-SchtasksQueryOutput -Name $Name
    return $query.ExitCode -eq 0
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

  $outputLines = @($query.Output)
  $stateMatch = $outputLines | Select-String -Pattern "Status:", "Estado de tarefa agendada:" | Select-Object -First 1
  $lastResultMatch = $outputLines | Select-String -Pattern "Last Result:", "Ultimo resultado:", "Ãšltimo resultado:" | Select-Object -First 1
  $state = if ($stateMatch) { (($stateMatch.ToString()) -split ":\s*", 2)[-1] } else { "unknown" }
  $lastResult = if ($lastResultMatch) { (($lastResultMatch.ToString()) -split ":\s*", 2)[-1] } else { "unknown" }
  Write-Host "task=present name=$TaskName state=$state lastResult=$lastResult source=schtasks"
  exit 0
}
