param(
  [string]$WorkspacePath = "",
  [string]$Distro = "",
  [string]$User = "",
  [int]$Port = 3000,
  [int]$Iterations = 1,
  [int]$TimeoutMs = 45000,
  [string]$ApiKey = ""
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

if (-not (Get-Command wsl -ErrorAction SilentlyContinue)) {
  throw "WSL nao encontrado. O script bench:rag:router:wsl requer WSL habilitado."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
  $WorkspacePath = $env:NEXT_WSL_WORKSPACE_DIR
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
  throw "Nao foi possivel resolver workspace no WSL. Defina NEXT_WSL_WORKSPACE_DIR."
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

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  $ApiKey = $env:BENCH_API_KEY
}
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  $ApiKey = $env:PUBLIC_API_KEY
}
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  $ApiKey = "token-local"
}

$safeWorkspacePath = Escape-BashDoubleQuoted $WorkspacePath
$safeApiKey = Escape-BashDoubleQuoted $ApiKey
$chatUrl = "http://127.0.0.1:$Port/api/chat"
$metricsUrl = "http://127.0.0.1:$Port/api/chat/router-metrics"
$safeChatUrl = Escape-BashDoubleQuoted $chatUrl
$safeMetricsUrl = Escape-BashDoubleQuoted $metricsUrl

$command = @(
  "cd `"$safeWorkspacePath`"",
  "export BENCH_CHAT_URL=`"$safeChatUrl`"",
  "export BENCH_METRICS_URL=`"$safeMetricsUrl`"",
  "export BENCH_API_KEY=`"$safeApiKey`"",
  "export BENCH_ROUTER_ITERATIONS=$Iterations",
  "export BENCH_ROUTER_TIMEOUT_MS=$TimeoutMs",
  "bash `"scripts/run-bench-rag-router.sh`""
) -join " && "

Invoke-WslBash $command
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
