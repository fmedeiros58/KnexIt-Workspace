param(
  [switch]$SkipKubectl,
  [switch]$SkipKind,
  [switch]$SkipHelm
)

$ErrorActionPreference = "Stop"

function Resolve-ToolPath([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }
  if ($Name -eq "kubectl") {
    return Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA "Microsoft\\WinGet\\Packages\\Kubernetes.kubectl*") -Filter "kubectl.exe" -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
  }
  if ($Name -eq "kind") {
    return Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA "Microsoft\\WinGet\\Packages\\Kubernetes.kind*") -Filter "kind.exe" -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
  }
  if ($Name -eq "helm") {
    return Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA "Microsoft\\WinGet\\Packages\\Helm.Helm*") -Filter "helm.exe" -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
  }
  return ""
}

function Test-CommandExists([string]$Name) {
  return -not [string]::IsNullOrWhiteSpace((Resolve-ToolPath $Name))
}

function Refresh-WingetLinksPath {
  $wingetLinks = Join-Path $env:LOCALAPPDATA "Microsoft\\WinGet\\Links"
  if ((Test-Path $wingetLinks) -and -not (($env:PATH -split ";") -contains $wingetLinks)) {
    $env:PATH = "$wingetLinks;$env:PATH"
  }
}

function Invoke-Install([string]$Label, [string]$CommandName, [scriptblock]$Installer) {
  try {
    & $Installer
    Refresh-WingetLinksPath
    if (Test-CommandExists $CommandName) {
      Write-Host "[ok] $Label instalado/verificado."
      return $true
    }
    Write-Warning "[warn] $Label aparentemente instalado, mas ainda indisponivel no PATH atual. Abra um novo terminal e rode novamente."
    return $true
  }
  catch {
    Write-Warning "[fail] Nao foi possivel instalar $Label automaticamente: $($_.Exception.Message)"
    return $false
  }
}

function Install-WithWinget([string]$PackageId) {
  winget install --id $PackageId --exact --accept-package-agreements --accept-source-agreements --silent | Out-Null
}

function Install-WithChoco([string]$PackageName) {
  choco install $PackageName -y | Out-Null
}

if (-not $SkipKubectl -and -not (Test-CommandExists "kubectl")) {
  if (Test-CommandExists "winget") {
    Invoke-Install "kubectl" "kubectl" { Install-WithWinget "Kubernetes.kubectl" } | Out-Null
  } elseif (Test-CommandExists "choco") {
    Invoke-Install "kubectl" "kubectl" { Install-WithChoco "kubernetes-cli" } | Out-Null
  } else {
    Write-Warning "winget/choco nao encontrados. Instale kubectl manualmente."
  }
}

if (-not $SkipKind -and -not (Test-CommandExists "kind")) {
  if (Test-CommandExists "winget") {
    Invoke-Install "kind" "kind" { Install-WithWinget "Kubernetes.kind" } | Out-Null
  } elseif (Test-CommandExists "choco") {
    Invoke-Install "kind" "kind" { Install-WithChoco "kind" } | Out-Null
  } else {
    Write-Warning "winget/choco nao encontrados. Instale kind manualmente."
  }
}

if (-not $SkipHelm -and -not (Test-CommandExists "helm")) {
  if (Test-CommandExists "winget") {
    Invoke-Install "helm" "helm" { Install-WithWinget "Helm.Helm" } | Out-Null
  } elseif (Test-CommandExists "choco") {
    Invoke-Install "helm" "helm" { Install-WithChoco "kubernetes-helm" } | Out-Null
  } else {
    Write-Warning "winget/choco nao encontrados. Instale helm manualmente."
  }
}

Write-Host "--- tool versions ---"
$kubectlPath = Resolve-ToolPath "kubectl"
if ($kubectlPath) { & $kubectlPath version --client }
$kindPath = Resolve-ToolPath "kind"
if ($kindPath) { & $kindPath version }
$helmPath = Resolve-ToolPath "helm"
if ($helmPath) { & $helmPath version --short }
