param(
  [string]$WorkspacePath = "",
  [string]$EntryScript = "scripts/serve-embeddings-cpu.sh"
)

$ErrorActionPreference = "Stop"

function Escape-BashDoubleQuoted([string]$value) {
  return $value.Replace('"', '\"')
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

if (-not (Get-Command wsl -ErrorAction SilentlyContinue)) {
  throw "WSL nao encontrado. O script serve:embeddings:cpu requer WSL habilitado."
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

$entryScriptPath = if (-not [string]::IsNullOrWhiteSpace($env:EMBEDDING_CPU_WSL_ENTRY_SCRIPT)) {
  $env:EMBEDDING_CPU_WSL_ENTRY_SCRIPT
} else {
  $EntryScript
}
if ([string]::IsNullOrWhiteSpace($entryScriptPath)) {
  throw "Entry script de embeddings CPU vazio. Defina EMBEDDING_CPU_WSL_ENTRY_SCRIPT ou use -EntryScript."
}

$safeWorkspacePath = Escape-BashDoubleQuoted $WorkspacePath
$safeEntryScriptPath = Escape-BashDoubleQuoted $entryScriptPath

& wsl -e bash -lc "test -d `"$safeWorkspacePath`"" 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "Workspace WSL inexistente: $WorkspacePath"
}

& wsl -e bash -lc "test -f `"$safeWorkspacePath/$safeEntryScriptPath`"" 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "Entry script de embeddings CPU nao encontrado no workspace WSL: $WorkspacePath/$entryScriptPath"
}

$command = "cd `"$safeWorkspacePath`" && bash `"$safeEntryScriptPath`""

wsl -e bash -lc $command
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
