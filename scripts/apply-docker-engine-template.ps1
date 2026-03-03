param(
  [string]$TemplatePath = ""
)

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom([string]$path, [string]$content) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

function ConvertTo-Hashtable($obj) {
  if ($null -eq $obj) { return $null }

  if ($obj -is [System.Collections.IDictionary]) {
    $hash = @{}
    foreach ($key in $obj.Keys) {
      $hash[$key] = ConvertTo-Hashtable $obj[$key]
    }
    return $hash
  }

  if ($obj -is [System.Collections.IEnumerable] -and -not ($obj -is [string])) {
    $arr = @()
    foreach ($item in $obj) {
      $arr += ,(ConvertTo-Hashtable $item)
    }
    return $arr
  }

  if ($obj -is [psobject]) {
    $props = $obj.PSObject.Properties
    if ($props.Count -gt 0) {
      $hash = @{}
      foreach ($prop in $props) {
        $hash[$prop.Name] = ConvertTo-Hashtable $prop.Value
      }
      return $hash
    }
  }

  return $obj
}

function Merge-JsonTopLevel([hashtable]$base, [hashtable]$overlay) {
  $merged = @{}
  foreach ($entry in $base.GetEnumerator()) {
    $merged[$entry.Key] = $entry.Value
  }
  foreach ($entry in $overlay.GetEnumerator()) {
    $merged[$entry.Key] = $entry.Value
  }
  return $merged
}

function Wait-DockerReady {
  $maxAttempts = 60
  for ($i = 1; $i -le $maxAttempts; $i++) {
    try {
      $root = docker info --format "{{.DockerRootDir}}" 2>$null
      if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($root)) {
        return $root.Trim()
      }
    } catch {}
    Start-Sleep -Seconds 3
  }
  throw "Docker nao ficou pronto apos restart."
}

if ([string]::IsNullOrWhiteSpace($TemplatePath)) {
  if (-not [string]::IsNullOrWhiteSpace($env:DOCKER_ENGINE_TEMPLATE_PATH)) {
    $TemplatePath = $env:DOCKER_ENGINE_TEMPLATE_PATH
  } else {
    $TemplatePath = "infra/docker/docker-desktop-engine.nvme2.json"
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not [System.IO.Path]::IsPathRooted($TemplatePath)) {
  $TemplatePath = Join-Path $repoRoot $TemplatePath
}

if (-not (Test-Path $TemplatePath)) {
  throw "Template nao encontrado: $TemplatePath"
}

$templateRaw = Get-Content -Path $TemplatePath -Raw
$templateObject = ConvertTo-Hashtable ($templateRaw | ConvertFrom-Json)
if (-not $templateObject) {
  throw "Template vazio/invalido: $TemplatePath"
}

$daemonPath = Join-Path $env:USERPROFILE ".docker\daemon.json"
$daemonDir = Split-Path $daemonPath -Parent
if (-not (Test-Path $daemonDir)) {
  New-Item -Path $daemonDir -ItemType Directory -Force | Out-Null
}

$existing = @{}
if (Test-Path $daemonPath) {
  $existingRaw = Get-Content -Path $daemonPath -Raw
  if (-not [string]::IsNullOrWhiteSpace($existingRaw)) {
    $existing = ConvertTo-Hashtable ($existingRaw | ConvertFrom-Json)
  }
}

$merged = Merge-JsonTopLevel -base $existing -overlay $templateObject
$jsonOut = $merged | ConvertTo-Json -Depth 32
Write-Utf8NoBom -path $daemonPath -content "$jsonOut`n"

docker desktop restart | Out-Null
$rootDir = Wait-DockerReady

Write-Output "Template aplicado em: $daemonPath"
Write-Output "DockerRootDir atual: $rootDir"
