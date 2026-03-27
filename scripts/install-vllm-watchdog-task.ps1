param(
  [string]$TaskName = "KnexIT-Backends-Watchdog",
  [int]$IntervalSeconds = 20,
  [switch]$StartNow
)

$scriptPath = Join-Path $PSScriptRoot "install-backends-watchdog-task.ps1"
if (-not (Test-Path $scriptPath)) {
  throw "Script nao encontrado: $scriptPath"
}

& $scriptPath -TaskName $TaskName -IntervalSeconds $IntervalSeconds -StartNow:$StartNow

