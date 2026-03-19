param(
  [int]$IntervalSeconds = 20,
  [switch]$Once
)

$ErrorActionPreference = "Stop"

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

Write-Output "[watchdog] Monitorando apenas vLLM (8000). Intervalo=${IntervalSeconds}s."

do {
  $vllmOk = Ensure-Vllm
  $stamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  Write-Output "[watchdog] $stamp vLLM=$vllmOk"
  if ($Once) { break }
  Start-Sleep -Seconds $IntervalSeconds
} while ($true)
