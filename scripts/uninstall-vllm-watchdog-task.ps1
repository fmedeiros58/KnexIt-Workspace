param(
  [string]$TaskName = "KnexIT-Backends-Watchdog",
  [switch]$StopRunning
)

$scriptPath = Join-Path $PSScriptRoot "uninstall-backends-watchdog-task.ps1"
if (-not (Test-Path $scriptPath)) {
  throw "Script nao encontrado: $scriptPath"
}

& $scriptPath -TaskName $TaskName -StopRunning:$StopRunning

