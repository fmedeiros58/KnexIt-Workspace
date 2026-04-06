param(
  [string]$WorkspacePath = "",
  [string]$EntryScript = "scripts/serve-vllm.sh",
  [string]$Distro = "",
  [string]$User = ""
)

$ErrorActionPreference = "Stop"

function Escape-BashDoubleQuoted([string]$value) {
  return $value.Replace('"', '\"')
}

function Invoke-WslBash([string]$bashCommand) {
  $args = @()
  if (-not [string]::IsNullOrWhiteSpace($Distro)) {
    $args += @("-d", $Distro)
  }
  if (-not [string]::IsNullOrWhiteSpace($User)) {
    $args += @("-u", $User)
  }
  $args += @("-e", "bash", "-lc", $bashCommand)
  & wsl @args
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

if (-not (Get-Command wsl -ErrorAction SilentlyContinue)) {
  throw "WSL nao encontrado. O script serve:vllm:wsl requer WSL habilitado."
}

if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
  $WorkspacePath = $env:VLLM_WSL_WORKSPACE_DIR
}
if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
  $WorkspacePath = $env:AI_SYSTEM_ANM_WSL_WORKSPACE_DIR
}
if ([string]::IsNullOrWhiteSpace($Distro)) {
  $Distro = $env:VLLM_WSL_DISTRO
}
if ([string]::IsNullOrWhiteSpace($Distro)) {
  $Distro = $env:AI_SYSTEM_ANM_WSL_DISTRO
}
if ([string]::IsNullOrWhiteSpace($Distro)) {
  $Distro = $env:WSL_DISTRO_NAME
}
if ([string]::IsNullOrWhiteSpace($User)) {
  $User = $env:VLLM_WSL_USER
}
if ([string]::IsNullOrWhiteSpace($User)) {
  $User = $env:AI_SYSTEM_ANM_WSL_USER
}
if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
  $repoRootWindows = $repoRoot.Path.Replace("\", "/")
  $safeRepoRootWindows = Escape-BashDoubleQuoted $repoRootWindows
  $WorkspacePath = (& wsl -e bash -lc "wslpath -a `"$safeRepoRootWindows`"" 2>$null | Out-String).Trim()
}
if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
  throw "Nao foi possivel resolver workspace no WSL. Defina VLLM_WSL_WORKSPACE_DIR."
}

$entryScriptPath = if (-not [string]::IsNullOrWhiteSpace($env:VLLM_WSL_ENTRY_SCRIPT)) {
  $env:VLLM_WSL_ENTRY_SCRIPT
} else {
  $EntryScript
}
if ([string]::IsNullOrWhiteSpace($entryScriptPath)) {
  throw "Entry script do vLLM vazio. Defina VLLM_WSL_ENTRY_SCRIPT ou use -EntryScript."
}

$effectiveVllmHost = ""
if ($null -ne $env:VLLM_HOST) {
  $effectiveVllmHost = "$($env:VLLM_HOST)"
}
$effectiveVllmHost = $effectiveVllmHost.Trim()
if ($effectiveVllmHost -eq "0.0.0.0" -or $effectiveVllmHost -eq "::") {
  Write-Warning "VLLM_HOST=$effectiveVllmHost expoe o motor fora do loopback. Prefira 127.0.0.1 em host-only."
}

$safeWorkspacePath = Escape-BashDoubleQuoted $WorkspacePath
$safeEntryScriptPath = Escape-BashDoubleQuoted $entryScriptPath
$safeVllmHost = Escape-BashDoubleQuoted $effectiveVllmHost

Invoke-WslBash "test -d `"$safeWorkspacePath`"" 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "Workspace WSL inexistente: $WorkspacePath"
}

Invoke-WslBash "test -f `"$safeWorkspacePath/$safeEntryScriptPath`"" 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "Entry script do vLLM nao encontrado no workspace WSL: $WorkspacePath/$entryScriptPath"
}

$envPrefix = @()
if (-not [string]::IsNullOrWhiteSpace($safeVllmHost)) {
  $envPrefix += "VLLM_HOST=`"$safeVllmHost`""
}
if (-not [string]::IsNullOrWhiteSpace($env:VLLM_FORCE_RESTART)) {
  $envPrefix += "VLLM_FORCE_RESTART=`"$($env:VLLM_FORCE_RESTART)`""
}
if (-not [string]::IsNullOrWhiteSpace($env:VLLM_KILL_PORT_OWNER)) {
  $envPrefix += "VLLM_KILL_PORT_OWNER=`"$($env:VLLM_KILL_PORT_OWNER)`""
}
if (-not [string]::IsNullOrWhiteSpace($env:VLLM_REUSE_EXISTING)) {
  $envPrefix += "VLLM_REUSE_EXISTING=`"$($env:VLLM_REUSE_EXISTING)`""
}

$envPrefixText = ""
if ($envPrefix.Count -gt 0) {
  $envPrefixText = "$($envPrefix -join ' ') "
}

$command = "cd `"$safeWorkspacePath`" && ${envPrefixText}bash `"$safeEntryScriptPath`""

Invoke-WslBash $command
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

