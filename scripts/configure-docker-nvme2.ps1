param(
  [string]$DataRoot = "",
  [string]$TemplatePath = ""
)

$ErrorActionPreference = "Stop"

function Get-CurrentDockerRootDir {
  try {
    $root = docker info --format "{{.DockerRootDir}}" 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($root)) {
      return $root.Trim()
    }
  } catch {}
  return ""
}

function Get-DockerDiskBusType {
  try {
    $dockerDisk = "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx"
    if (-not (Test-Path $dockerDisk)) {
      return ""
    }
    $driveLetter = (Split-Path $dockerDisk -Qualifier).TrimEnd(":\")
    $partition = Get-Partition -DriveLetter $driveLetter -ErrorAction Stop | Select-Object -First 1
    $disk = Get-Disk -Number $partition.DiskNumber -ErrorAction Stop
    return [string]$disk.BusType
  } catch {
    return ""
  }
}

if ([string]::IsNullOrWhiteSpace($DataRoot) -and -not [string]::IsNullOrWhiteSpace($env:DOCKER_DATA_ROOT)) {
  $DataRoot = $env:DOCKER_DATA_ROOT
}

if ([string]::IsNullOrWhiteSpace($DataRoot)) {
  $DataRoot = Get-CurrentDockerRootDir
  if ([string]::IsNullOrWhiteSpace($DataRoot)) {
    $DataRoot = "/var/lib/docker"
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$templatePath = if (-not [string]::IsNullOrWhiteSpace($TemplatePath)) {
  $TemplatePath
} elseif (-not [string]::IsNullOrWhiteSpace($env:DOCKER_ENGINE_TEMPLATE_PATH)) {
  $env:DOCKER_ENGINE_TEMPLATE_PATH
} else {
  "infra/docker/docker-desktop-engine.nvme2.json"
}
if (-not [System.IO.Path]::IsPathRooted($templatePath)) {
  $templatePath = Join-Path $repoRoot $templatePath
}
$templateContent = "{`n  `"data-root`": `"$DataRoot`"`n}`n"
Set-Content -Path $templatePath -Value $templateContent -Encoding UTF8

$diskBusType = Get-DockerDiskBusType

Write-Output "Template criado em: $templatePath"
Write-Output "Docker data-root (template): $DataRoot"
if ($diskBusType) {
  Write-Output "Drive do disco Docker Desktop (host): $diskBusType"
}

Write-Output ""
Write-Output "Aplicacao manual recomendada (Docker Desktop):"
Write-Output "1) Settings -> Docker Engine"
Write-Output "2) Mesclar o conteudo de infra/docker/docker-desktop-engine.nvme2.json"
Write-Output "3) Apply & Restart"
Write-Output ""
Write-Output "Observacao: em Windows/WSL2, mover para outro NVMe e feito pela localizacao do disco do Docker Desktop."
Write-Output "Se usar Linux host (dockerd nativo), aplique em /etc/docker/daemon.json e reinicie o docker."
