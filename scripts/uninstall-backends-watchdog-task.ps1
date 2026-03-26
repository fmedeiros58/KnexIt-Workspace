$ErrorActionPreference = "Stop"
$canonicalScript = Join-Path $PSScriptRoot "..\ai-system-anm-rag-qis\scripts\uninstall-backends-watchdog-task.ps1"
$canonicalScript = (Resolve-Path $canonicalScript -ErrorAction Stop).Path

if (-not (Test-Path $canonicalScript)) {
  throw "Canonical watchdog uninstall script not found at: $canonicalScript"
}

& $canonicalScript @args
if ($null -eq $LASTEXITCODE) { exit 0 }
exit $LASTEXITCODE

