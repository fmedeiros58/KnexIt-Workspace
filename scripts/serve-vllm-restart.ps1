param(
  [string]$WorkspacePath = "",
  [string]$Distro = "",
  [string]$User = ""
)

$ErrorActionPreference = "Stop"

$previousForceRestart = $env:VLLM_FORCE_RESTART
$previousKillPortOwner = $env:VLLM_KILL_PORT_OWNER

try {
  $env:VLLM_FORCE_RESTART = "1"
  $env:VLLM_KILL_PORT_OWNER = "1"
  $targetScript = Join-Path $PSScriptRoot "serve-vllm-wsl.ps1"
  $args = @()
  if (-not [string]::IsNullOrWhiteSpace($WorkspacePath)) {
    $args += @("-WorkspacePath", $WorkspacePath)
  }
  if (-not [string]::IsNullOrWhiteSpace($Distro)) {
    $args += @("-Distro", $Distro)
  }
  if (-not [string]::IsNullOrWhiteSpace($User)) {
    $args += @("-User", $User)
  }
  & powershell -ExecutionPolicy Bypass -File $targetScript @args
} finally {
  if ($null -eq $previousForceRestart) {
    Remove-Item Env:VLLM_FORCE_RESTART -ErrorAction SilentlyContinue
  } else {
    $env:VLLM_FORCE_RESTART = $previousForceRestart
  }

  if ($null -eq $previousKillPortOwner) {
    Remove-Item Env:VLLM_KILL_PORT_OWNER -ErrorAction SilentlyContinue
  } else {
    $env:VLLM_KILL_PORT_OWNER = $previousKillPortOwner
  }
}
