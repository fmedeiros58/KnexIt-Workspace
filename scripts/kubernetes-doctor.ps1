$ErrorActionPreference = "Continue"

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

Write-Host "[doctor] Kubernetes tools"

 $kubectlPath = Resolve-ToolPath "kubectl" "Kubernetes.kubectl*"
if ($kubectlPath) {
  Write-Host "- kubectl: ok"
  Write-Host "  path: $kubectlPath"
  & $kubectlPath version --client
} else {
  Write-Warning "- kubectl: ausente"
}

 $kindPath = Resolve-ToolPath "kind" "Kubernetes.kind*"
if ($kindPath) {
  Write-Host "- kind: ok"
  Write-Host "  path: $kindPath"
  & $kindPath version
} else {
  Write-Warning "- kind: ausente"
}

 $helmPath = Resolve-ToolPath "helm" "Helm.Helm*"
if ($helmPath) {
  Write-Host "- helm: ok"
  Write-Host "  path: $helmPath"
  & $helmPath version --short
} else {
  Write-Warning "- helm: ausente"
}

Write-Host "[doctor] cluster connectivity"
if ($kubectlPath) {
  & $kubectlPath cluster-info
}
