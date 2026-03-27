param(
  [string]$TaskName = "KnexIT-Backends-Watchdog"
)

$scriptPath = Join-Path $PSScriptRoot "status-backends-watchdog-task.ps1"
if (-not (Test-Path $scriptPath)) {
  throw "Script nao encontrado: $scriptPath"
}

& $scriptPath -TaskName $TaskName

