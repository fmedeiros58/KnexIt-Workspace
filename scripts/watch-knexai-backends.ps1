param(
  [int]$IntervalSeconds = 20,
  [switch]$Once
)

$ErrorActionPreference = "Stop"
$legacyAnmFlagRaw = "${env:KNEXAI_WATCHDOG_LEGACY_ANM_ENABLED}".Trim().ToLowerInvariant()
$watchLegacyAnm = @("1", "true", "yes", "on") -contains $legacyAnmFlagRaw

function Join-ScriptPath([string]$scriptName) {
  return Join-Path $PSScriptRoot $scriptName
}

function Test-Health([string]$url, [int]$timeoutSec = 3) {
  try {
    $response = Invoke-WebRequest -Uri $url -TimeoutSec $timeoutSec
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
  } catch {
    return $false
  }
}

function Find-ProcessByPattern([string]$pattern) {
  try {
    return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
      $_.CommandLine -and $_.CommandLine -match $pattern
    })
  } catch {
    return @()
  }
}

function Start-DetachedPowerShellScript([string]$scriptPath) {
  Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-ExecutionPolicy", "Bypass", "-File", $scriptPath
  ) -WindowStyle Minimized | Out-Null
}

function Ensure-Anm {
  if (-not $watchLegacyAnm) {
    return $true
  }

  $healthy = Test-Health "http://127.0.0.1:8100/healthz"
  if ($healthy) { return $true }

  $running = Find-ProcessByPattern "serve-anm-wsl\.ps1|serve-anm\.sh"
  if ($running.Count -eq 0) {
    Start-DetachedPowerShellScript (Join-ScriptPath "serve-anm-wsl.ps1")
    Write-Host "[ANM] Offline -> start acionado."
  } else {
    Write-Host "[ANM] Offline e processo de bootstrap em execucao; aguardando."
  }
  return $false
}

function Ensure-Vllm {
  $healthy = Test-Health "http://127.0.0.1:8000/v1/models"
  if ($healthy) { return $true }

  $running = Find-ProcessByPattern "serve-vllm-wsl\.ps1|serve-vllm-restart\.ps1|serve-vllm\.sh|vllm serve"
  if ($running.Count -eq 0) {
    Start-DetachedPowerShellScript (Join-ScriptPath "serve-vllm-restart.ps1")
    Write-Host "[vLLM] Offline -> restart acionado."
  } else {
    Write-Host "[vLLM] Offline e processo de bootstrap em execucao; aguardando."
  }
  return $false
}

if ($IntervalSeconds -lt 5) {
  $IntervalSeconds = 5
}

if ($watchLegacyAnm) {
  Write-Output "[watchdog] Monitorando ANM legado (8100) e vLLM (8000). Intervalo=${IntervalSeconds}s."
} else {
  Write-Output "[watchdog] Monitorando apenas vLLM (8000). ANM legado desativado por padrao. Intervalo=${IntervalSeconds}s."
}

do {
  $vllmOk = Ensure-Vllm
  $anmOk = Ensure-Anm
  $stamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  Write-Output "[watchdog] $stamp ANM=$anmOk vLLM=$vllmOk"
  if ($Once) { break }
  Start-Sleep -Seconds $IntervalSeconds
} while ($true)
