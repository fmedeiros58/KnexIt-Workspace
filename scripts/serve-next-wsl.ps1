param(
  [string]$WorkspacePath = "",
  [string]$EntryScript = "scripts/serve-next.sh",
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
  throw "WSL nao encontrado. O script serve:next:wsl requer WSL habilitado."
}

if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
  $WorkspacePath = $env:NEXT_WSL_WORKSPACE_DIR
}
if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
  $WorkspacePath = $env:ANM_WSL_WORKSPACE_DIR
}
if ([string]::IsNullOrWhiteSpace($Distro)) {
  $Distro = $env:NEXT_WSL_DISTRO
}
if ([string]::IsNullOrWhiteSpace($Distro)) {
  $Distro = $env:ANM_WSL_DISTRO
}
if ([string]::IsNullOrWhiteSpace($Distro)) {
  $Distro = $env:WSL_DISTRO_NAME
}
if ([string]::IsNullOrWhiteSpace($User)) {
  $User = $env:NEXT_WSL_USER
}
if ([string]::IsNullOrWhiteSpace($User)) {
  $User = $env:ANM_WSL_USER
}

if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
  $repoRootWindows = $repoRoot.Path.Replace("\", "/")
  $safeRepoRootWindows = Escape-BashDoubleQuoted $repoRootWindows
  $WorkspacePath = (& wsl -e bash -lc "wslpath -a `"$safeRepoRootWindows`"" 2>$null | Out-String).Trim()
}
if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
  throw "Nao foi possivel resolver workspace no WSL. Defina NEXT_WSL_WORKSPACE_DIR."
}

$entryScriptPath = if (-not [string]::IsNullOrWhiteSpace($env:NEXT_WSL_ENTRY_SCRIPT)) {
  $env:NEXT_WSL_ENTRY_SCRIPT
} else {
  $EntryScript
}
if ([string]::IsNullOrWhiteSpace($entryScriptPath)) {
  throw "Entry script do Next vazio. Defina NEXT_WSL_ENTRY_SCRIPT ou use -EntryScript."
}

$safeWorkspacePath = Escape-BashDoubleQuoted $WorkspacePath
$safeEntryScriptPath = Escape-BashDoubleQuoted $entryScriptPath

Invoke-WslBash "test -d `"$safeWorkspacePath`"" 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "Workspace WSL inexistente: $WorkspacePath"
}

Invoke-WslBash "test -f `"$safeWorkspacePath/$safeEntryScriptPath`"" 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "Entry script do Next nao encontrado no workspace WSL: $WorkspacePath/$entryScriptPath"
}

$command = "cd `"$safeWorkspacePath`" && bash `"$safeEntryScriptPath`""
Invoke-WslBash $command
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
