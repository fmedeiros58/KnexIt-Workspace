param(
  [string]$TaskName = "KnexIT-Docker-Watchdog",
  [switch]$StopRunning
)

$ErrorActionPreference = "Stop"
$hasNativePreference = Test-Path variable:PSNativeCommandUseErrorActionPreference
if ($hasNativePreference) {
  $previousNativePreference = $PSNativeCommandUseErrorActionPreference
}

function Invoke-Schtasks {
  param(
    [string[]]$Arguments
  )

  try {
    $previousErrorActionPreference = $ErrorActionPreference
    $script:ErrorActionPreference = "Continue"
    if ($hasNativePreference) {
      $script:PSNativeCommandUseErrorActionPreference = $false
    }
    $output = & schtasks.exe @Arguments 2>&1
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
  if ($StopRunning) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  }
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "[ok] tarefa removida: $TaskName"
  exit 0
} catch {
  $query = Invoke-Schtasks -Arguments @("/Query", "/TN", $TaskName, "/FO", "LIST", "/V")
  if ($query.ExitCode -ne 0) {
    Write-Host "[ok] tarefa nao encontrada: $TaskName"
    exit 0
  }

  if ($StopRunning) {
    [void](Invoke-Schtasks -Arguments @("/End", "/TN", $TaskName))
  }
  $deleted = Invoke-Schtasks -Arguments @("/Delete", "/F", "/TN", $TaskName)
  if ($deleted.ExitCode -ne 0) {
    throw "Falha ao remover tarefa via schtasks.exe (exit=$($deleted.ExitCode))."
  }
  Write-Host "[ok] tarefa removida: $TaskName (via schtasks.exe)"
}
