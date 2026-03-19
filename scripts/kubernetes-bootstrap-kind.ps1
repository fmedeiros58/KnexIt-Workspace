param(
  [string]$ClusterName = "knexit-local",
  [ValidateSet("base", "selfhost")]
  [string]$Profile = "base",
  [string]$KustomizePath = ""
)

$ErrorActionPreference = "Stop"

function Resolve-ToolPath([string]$Name, [string]$wingetSubpath) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }
  $pattern = Join-Path $env:LOCALAPPDATA "Microsoft\\WinGet\\Packages\\$wingetSubpath"
  $candidate = Get-ChildItem -Path $pattern -Filter "$Name.exe" -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
  return $candidate
}

function Invoke-Checked([string]$ToolPath, [string[]]$Arguments) {
  & $ToolPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    $joined = ($Arguments -join " ")
    throw "falha ao executar: $ToolPath $joined"
  }
}

docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "docker daemon indisponivel. Inicie/reinicie o Docker Desktop e tente novamente."
}

$kindPath = Resolve-ToolPath "kind" "Kubernetes.kind*"
if (-not $kindPath) {
  throw "kind nao encontrado. Rode scripts/install-kubernetes-tools.ps1 primeiro."
}

$kubectlPath = Resolve-ToolPath "kubectl" "Kubernetes.kubectl*"
if (-not $kubectlPath) {
  throw "kubectl nao encontrado. Rode scripts/install-kubernetes-tools.ps1 primeiro."
}

if ([string]::IsNullOrWhiteSpace($KustomizePath)) {
  switch ($Profile) {
    "selfhost" {
      $KustomizePath = "deploy/kubernetes-selfhost"
    }
    default {
      $KustomizePath = "deploy/kubernetes"
    }
  }
}

Write-Host "using kind: $kindPath"
Write-Host "using kubectl: $kubectlPath"

$clusters = & $kindPath get clusters
if ($LASTEXITCODE -ne 0) {
  throw "falha ao listar clusters kind. Verifique se o Docker daemon esta ativo."
}
if ($clusters -notcontains $ClusterName) {
  Invoke-Checked $kindPath @("create", "cluster", "--name", $ClusterName)
}

Invoke-Checked $kubectlPath @("config", "use-context", "kind-$ClusterName")
Invoke-Checked $kubectlPath @("apply", "-k", $KustomizePath)
Invoke-Checked $kubectlPath @("-n", "knexit", "rollout", "status", "deploy/vllm", "--timeout=900s")
Invoke-Checked $kubectlPath @("-n", "knexit", "rollout", "status", "deploy/knexit-web", "--timeout=300s")
Invoke-Checked $kubectlPath @("-n", "knexit", "get", "pods", "-o", "wide")
