param(
  [string]$ClusterName = "knexit-local",
  [string]$WebImage = "knexit-web:local",
  [switch]$SkipWeb
)

$ErrorActionPreference = "Stop"

function Resolve-KindBinary {
  $cmd = Get-Command kind -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  if ($cmd -and $cmd.Path) { return $cmd.Path }

  $localPath = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA "Microsoft\\WinGet\\Packages\\Kubernetes.kind*") -Filter "kind.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($localPath -and $localPath.FullName) { return $localPath.FullName }

  throw "kind nao encontrado"
}

$kindExe = Resolve-KindBinary

if (-not $SkipWeb) {
  & $kindExe load docker-image $WebImage --name $ClusterName
  if ($LASTEXITCODE -ne 0) { throw "falha ao carregar imagem web no kind" }
}

Write-Host "[ok] imagens carregadas no cluster kind-$ClusterName"
