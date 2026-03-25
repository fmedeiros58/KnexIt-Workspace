param(
  [string]$ClusterName = "knexit-local",
  [string]$WebImage = "knexit-web:local",
  [string]$AnmImage = "anm-backend:local"
)

$ErrorActionPreference = "Stop"

$kindPath = Get-Command kind -ErrorAction SilentlyContinue
if (-not $kindPath) {
  $kindPath = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA "Microsoft\\WinGet\\Packages\\Kubernetes.kind*") -Filter "kind.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
}
if (-not $kindPath) { throw "kind nao encontrado" }

& $kindPath.Source load docker-image $WebImage --name $ClusterName
if ($LASTEXITCODE -ne 0) { throw "falha ao carregar imagem web no kind" }

& $kindPath.Source load docker-image $AnmImage --name $ClusterName
if ($LASTEXITCODE -ne 0) { throw "falha ao carregar imagem anm no kind" }

Write-Host "[ok] imagens carregadas no cluster kind-$ClusterName"
