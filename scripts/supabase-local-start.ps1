param(
  [switch]$SkipEnvUpdate,
  [switch]$SkipMigration,
  [string]$MigrationFile = "",
  [string]$VectorMigrationFile = "",
  [string]$VectorIndexMigrationFile = ""
)

$ErrorActionPreference = "Stop"

function Ensure-DockerReady {
  try {
    docker info 1>$null 2>$null
    if ($LASTEXITCODE -eq 0) {
      return
    }
  } catch {}

  $dockerDesktop = if (-not [string]::IsNullOrWhiteSpace($env:DOCKER_DESKTOP_EXE)) {
    $env:DOCKER_DESKTOP_EXE
  } else {
    "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  }
  if (Test-Path $dockerDesktop) {
    Start-Process $dockerDesktop | Out-Null
  }

  $maxAttempts = 36
  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    try {
      docker info 1>$null 2>$null
      if ($LASTEXITCODE -eq 0) {
        return
      }
    } catch {}
    Start-Sleep -Seconds 5
  }

  throw "Docker daemon nao ficou pronto dentro do tempo limite."
}

function Write-Utf8NoBom([string]$path, [string]$content) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

function Invoke-WslTestPath([string]$path, [string]$testFlag) {
  $wsl = Get-Command wsl -ErrorAction SilentlyContinue
  if (-not $wsl) {
    return $false
  }
  $replacement = '''"''"'''
  $safe = $path.Replace("'", $replacement)
  & wsl -e bash -lc "test $testFlag '$safe'" 1>$null 2>$null
  return ($LASTEXITCODE -eq 0)
}

function Test-ExistingPath([string]$path, [ValidateSet("Any", "Directory", "File")] [string]$kind = "Any") {
  if ([string]::IsNullOrWhiteSpace($path)) {
    return $false
  }

  if ($path.StartsWith("/")) {
    $flag = switch ($kind) {
      "Directory" { "-d" }
      "File" { "-f" }
      default { "-e" }
    }
    return Invoke-WslTestPath -path $path -testFlag $flag
  }

  if (-not (Test-Path $path)) {
    return $false
  }

  switch ($kind) {
    "Directory" { return (Test-Path $path -PathType Container) }
    "File" { return (Test-Path $path -PathType Leaf) }
    default { return $true }
  }
}

function Assert-WslForPosixPath([string]$path, [string]$label) {
  if (-not [string]::IsNullOrWhiteSpace($path) -and $path.StartsWith("/")) {
    if (-not (Get-Command wsl -ErrorAction SilentlyContinue)) {
      throw "$label em formato POSIX exige WSL habilitado. Path: $path"
    }
  }
}

function Assert-OptionalNvmeBasePath {
  $nvmeBasePath = [string]$env:NVME_BASE_PATH
  if ([string]::IsNullOrWhiteSpace($nvmeBasePath)) {
    return
  }

  Assert-WslForPosixPath -path $nvmeBasePath -label "NVME_BASE_PATH"

  if (-not (Test-ExistingPath -path $nvmeBasePath -kind Directory)) {
    throw "NVME_BASE_PATH configurado, mas nao encontrado: $nvmeBasePath. Verifique montagem/ordem de boot do volume."
  }
}

function Normalize-EnvLocalEncoding {
  $envPath = ".env.local"
  if (-not (Test-Path $envPath)) {
    return
  }

  $bytes = [System.IO.File]::ReadAllBytes($envPath)
  if ($bytes.Length -lt 3) {
    return
  }

  if ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $text = [System.IO.File]::ReadAllText($envPath)
    Write-Utf8NoBom -path $envPath -content $text
  }
}

function Get-SupabaseProjectId {
  $match = Select-String -Path "supabase/config.toml" -Pattern '^\s*project_id\s*=\s*"([^"]+)"' | Select-Object -First 1
  if (-not $match) {
    throw "Nao foi possivel ler project_id em supabase/config.toml"
  }
  return $match.Matches[0].Groups[1].Value
}

function Parse-KeyValueLines([string[]]$lines) {
  $result = @{}
  foreach ($rawLine in $lines) {
    $splitLines = $rawLine -split "`r?`n"
    foreach ($line in $splitLines) {
      $m = [regex]::Match($line, '^\s*([A-Z0-9_]+)="(.*)"\s*$')
      if ($m.Success) {
        $key = $m.Groups[1].Value
        $value = $m.Groups[2].Value
        $result[$key] = $value
      }
    }
  }
  return $result
}

function Set-OrAddEnvLine([string[]]$lines, [string]$key, [string]$value) {
  $updated = $false
  $next = @()
  foreach ($line in $lines) {
    if ($line -match "^\s*$key=") {
      if (-not $updated) {
        $next += "$key=$value"
        $updated = $true
      }
      continue
    }
    $next += $line
  }
  if (-not $updated) {
    $next += "$key=$value"
  }
  return ,$next
}

function Update-LocalEnv([hashtable]$status) {
  $envPath = ".env.local"
  $timestamp = Get-Date -Format "yyyyMMddHHmmss"
  if (Test-Path $envPath) {
    Copy-Item $envPath "$envPath.bak.$timestamp" -Force
  }

  $lines = if (Test-Path $envPath) { Get-Content $envPath } else { @() }

  $mapping = @{
    "NEXT_PUBLIC_SUPABASE_URL" = $status["API_URL"]
    "NEXT_PUBLIC_SUPABASE_ANON_KEY" = $status["ANON_KEY"]
    "SUPABASE_SERVICE_ROLE_KEY" = $status["SERVICE_ROLE_KEY"]
    "NEXT_PUBLIC_IDENTITY_SUPABASE_URL" = $status["API_URL"]
    "NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY" = $status["ANON_KEY"]
    "IDENTITY_SUPABASE_SERVICE_ROLE_KEY" = $status["SERVICE_ROLE_KEY"]
    "VECTOR_DATABASE_URL" = $status["DB_URL"]
  }

  foreach ($pair in $mapping.GetEnumerator()) {
    if ([string]::IsNullOrWhiteSpace($pair.Value)) {
      continue
    }
    $lines = Set-OrAddEnvLine -lines $lines -key $pair.Key -value $pair.Value
  }

  $finalText = [string]::Join("`r`n", $lines)
  if (-not $finalText.EndsWith("`r`n")) {
    $finalText = "$finalText`r`n"
  }
  Write-Utf8NoBom -path $envPath -content $finalText
}

function Apply-SqlMigration([string]$containerName, [string]$migrationPath, [string]$label) {
  if (-not (Test-ExistingPath -path $migrationPath -kind File)) {
    throw "Migration nao encontrada: $migrationPath"
  }
  try {
    Get-Content -Path $migrationPath -TotalCount 1 | Out-Null
  } catch {
    throw "Migration sem permissao de leitura: $migrationPath"
  }

  Get-Content -Raw $migrationPath | docker exec -i $containerName psql -v ON_ERROR_STOP=1 -U postgres -d postgres
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar migration em $containerName"
  }
  Write-Output "OK ${label}: $migrationPath"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$migrationDir = if (-not [string]::IsNullOrWhiteSpace($env:MIGRATIONS_PATH)) {
  $env:MIGRATIONS_PATH
} else {
  "supabase/migrations"
}

if ([string]::IsNullOrWhiteSpace($MigrationFile)) {
  if (-not [string]::IsNullOrWhiteSpace($env:KNEXAI_MIGRATION_FILE)) {
    $MigrationFile = $env:KNEXAI_MIGRATION_FILE
  } else {
    $MigrationFile = Join-Path $migrationDir "20260302195000_create_knexai_unified_local.sql"
  }
}

if ([string]::IsNullOrWhiteSpace($VectorMigrationFile)) {
  if (-not [string]::IsNullOrWhiteSpace($env:VECTOR_MIGRATION_FILE)) {
    $VectorMigrationFile = $env:VECTOR_MIGRATION_FILE
  } else {
    $VectorMigrationFile = Join-Path $migrationDir "20260303120000_create_rag_base_schema.sql"
  }
}
if ([string]::IsNullOrWhiteSpace($VectorIndexMigrationFile)) {
  if (-not [string]::IsNullOrWhiteSpace($env:VECTOR_HNSW_MIGRATION_FILE)) {
    $VectorIndexMigrationFile = $env:VECTOR_HNSW_MIGRATION_FILE
  } else {
    $VectorIndexMigrationFile = Join-Path $migrationDir "20260303130000_add_hnsw_index_chunk_embeddings.sql"
  }
}

Assert-OptionalNvmeBasePath

if (-not (Test-ExistingPath -path $MigrationFile -kind File)) {
  Assert-WslForPosixPath -path $MigrationFile -label "KNEXAI_MIGRATION_FILE"
  throw "Arquivo de migration configurado nao existe: $MigrationFile"
}
if (-not (Test-ExistingPath -path $VectorMigrationFile -kind File)) {
  Assert-WslForPosixPath -path $VectorMigrationFile -label "VECTOR_MIGRATION_FILE"
  throw "Arquivo de migration vetorial configurado nao existe: $VectorMigrationFile"
}
if (-not (Test-ExistingPath -path $VectorIndexMigrationFile -kind File)) {
  Assert-WslForPosixPath -path $VectorIndexMigrationFile -label "VECTOR_HNSW_MIGRATION_FILE"
  throw "Arquivo de migration HNSW configurado nao existe: $VectorIndexMigrationFile"
}

Ensure-DockerReady
Normalize-EnvLocalEncoding

$startOutput = & cmd /c "npx -y supabase@latest start 2>&1"
$startExit = $LASTEXITCODE
if ($startExit -ne 0) {
  $startText = $startOutput -join "`n"
  if ($startText -notmatch "already running") {
    throw "Falha no supabase start: $startText"
  }
}

$statusOutput = & cmd /c "npx -y supabase@latest status -o env 2>&1"
$statusExit = $LASTEXITCODE
if ($statusExit -ne 0) {
  throw "Falha ao obter env do Supabase local."
}
$status = Parse-KeyValueLines -lines @($statusOutput)

if (-not $SkipEnvUpdate) {
  Update-LocalEnv -status $status
}

if (-not $SkipMigration) {
  $projectId = Get-SupabaseProjectId
  $dbContainer = "supabase_db_$projectId"
  Apply-SqlMigration -containerName $dbContainer -migrationPath $MigrationFile -label "migration KnexAI"
  Apply-SqlMigration -containerName $dbContainer -migrationPath $VectorMigrationFile -label "migration pgvector"
  Apply-SqlMigration -containerName $dbContainer -migrationPath $VectorIndexMigrationFile -label "migration hnsw"
}

Write-Output "Supabase local pronto."
Write-Output "API_URL=$($status["API_URL"])"
Write-Output "DB_URL=$($status["DB_URL"])"
Write-Output "STUDIO_URL=$($status["STUDIO_URL"])"
