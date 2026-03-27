param(
  [string]$WebImage = "knexit-web:local",
  [switch]$SkipWeb
)

$ErrorActionPreference = "Stop"

function Invoke-DockerBuildWithFallback {
  param(
    [string]$DockerfilePath,
    [string]$ImageTag,
    [string]$FriendlyName
  )

  Write-Host "[build] $FriendlyName image: $ImageTag"
  docker build -f $DockerfilePath -t $ImageTag .
  if ($LASTEXITCODE -eq 0) { return }

  Write-Warning "[build] falha no modo BuildKit padrao para $FriendlyName. Tentando fallback com DOCKER_BUILDKIT=0."
  $previousBuildkit = $env:DOCKER_BUILDKIT
  try {
    $env:DOCKER_BUILDKIT = "0"
    docker build -f $DockerfilePath -t $ImageTag .
    if ($LASTEXITCODE -ne 0) { throw "falha no build da imagem $FriendlyName" }
  } finally {
    if ($null -eq $previousBuildkit) {
      Remove-Item Env:DOCKER_BUILDKIT -ErrorAction SilentlyContinue
    } else {
      $env:DOCKER_BUILDKIT = $previousBuildkit
    }
  }
}

if (-not $SkipWeb) {
  Invoke-DockerBuildWithFallback -DockerfilePath "infra/docker/Dockerfile.web" -ImageTag $WebImage -FriendlyName "web"
}

Write-Host "[ok] imagens locais prontas"
