param(
  [string]$WorkspacePath = ""
)

$ErrorActionPreference = "Stop"

function Escape-BashDoubleQuoted([string]$value) {
  return $value.Replace('"', '\"')
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

if (-not (Get-Command wsl -ErrorAction SilentlyContinue)) {
  throw "WSL nao encontrado. O script serve:embeddings:cpu:restart requer WSL habilitado."
}

if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
  $WorkspacePath = $env:EMBEDDING_CPU_WSL_WORKSPACE_DIR
}
if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
  $WorkspacePath = $env:ANM_WSL_WORKSPACE_DIR
}
if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
  $repoRootWindows = $repoRoot.Path.Replace("\", "/")
  $safeRepoRootWindows = Escape-BashDoubleQuoted $repoRootWindows
  $WorkspacePath = (& wsl -e bash -lc "wslpath -a `"$safeRepoRootWindows`"" 2>$null | Out-String).Trim()
}
if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
  throw "Nao foi possivel resolver workspace no WSL. Defina EMBEDDING_CPU_WSL_WORKSPACE_DIR."
}

$safeWorkspacePath = Escape-BashDoubleQuoted $WorkspacePath

Write-Output "[INFO] Encerrando servidor de embeddings em CPU antigo (se existir)..."
& wsl -e bash -lc "cd `"$safeWorkspacePath`" && pkill -f 'scripts/embedding_cpu_server.py' || true"

Write-Output "[INFO] Subindo servidor de embeddings em CPU..."
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "serve-embeddings-cpu-wsl.ps1") -WorkspacePath $WorkspacePath
