param(
  [string]$WebImage = "knexit-web:local",
  [string]$AnmImage = "anm-backend:local",
  [switch]$SkipWeb,
  [switch]$SkipAnm
)

$ErrorActionPreference = "Stop"

if (-not $SkipWeb) {
  Write-Host "[build] web image: $WebImage"
  docker build -f infra/docker/Dockerfile.web -t $WebImage .
  if ($LASTEXITCODE -ne 0) { throw "falha no build da imagem web" }
}

if (-not $SkipAnm) {
  Write-Host "[build] anm image: $AnmImage"
  docker build -f infra/docker/Dockerfile.anm-backend -t $AnmImage .
  if ($LASTEXITCODE -ne 0) { throw "falha no build da imagem anm" }
}

Write-Host "[ok] imagens locais prontas"
