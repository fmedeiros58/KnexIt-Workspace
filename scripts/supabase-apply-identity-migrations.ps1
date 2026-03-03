param(
  [string]$IdentityMigrationsPath = "supabase/identity/migrations"
)

$ErrorActionPreference = "Stop"

function Get-SupabaseProjectId {
  $match = Select-String -Path "supabase/config.toml" -Pattern '^\s*project_id\s*=\s*"([^"]+)"' | Select-Object -First 1
  if (-not $match) {
    throw "Nao foi possivel ler project_id em supabase/config.toml"
  }
  return $match.Matches[0].Groups[1].Value
}

function Ensure-ContainerRunning([string]$containerName) {
  $running = (& docker ps --format "{{.Names}}" | Select-String -Pattern ("^{0}$" -f [regex]::Escape($containerName)) -Quiet)
  if (-not $running) {
    throw "Container do Supabase local nao esta ativo: $containerName. Rode 'npm run supabase:local:start' antes."
  }
}

function Get-IdentityMigrationFiles([string]$path) {
  if (-not (Test-Path $path -PathType Container)) {
    throw "Diretorio de migrations de identidade nao encontrado: $path"
  }
  return Get-ChildItem -Path $path -Filter "*.sql" -File | Sort-Object Name
}

function Parse-MigrationVersion([System.IO.FileInfo]$file) {
  $match = [regex]::Match($file.BaseName, '^(\d+)_')
  if (-not $match.Success) {
    throw "Arquivo sem prefixo de versao numerico: $($file.Name)"
  }
  return $match.Groups[1].Value
}

function Test-MigrationApplied([string]$containerName, [string]$version) {
  $result = & docker exec $containerName psql -U postgres -d postgres -Atc "select 1 from supabase_migrations.schema_migrations where version = '$version' limit 1;" 2>$null
  return (($result | Out-String).Trim() -eq "1")
}

function Register-Migration([string]$containerName, [string]$version, [string]$name) {
  & docker exec $containerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "insert into supabase_migrations.schema_migrations(version,name) values ('$version','$name') on conflict (version) do nothing;" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao registrar migration de identidade: version=$version"
  }
}

function Apply-IdentityMigration([string]$containerName, [System.IO.FileInfo]$file) {
  Get-Content -Raw $file.FullName | docker exec -i $containerName psql -v ON_ERROR_STOP=1 -U postgres -d postgres
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar migration de identidade: $($file.FullName)"
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$projectId = Get-SupabaseProjectId
$dbContainer = "supabase_db_$projectId"
Ensure-ContainerRunning -containerName $dbContainer

$files = Get-IdentityMigrationFiles -path $IdentityMigrationsPath
if (-not $files -or $files.Count -eq 0) {
  Write-Output "Nenhuma migration de identidade encontrada em $IdentityMigrationsPath."
  exit 0
}

foreach ($file in $files) {
  $version = Parse-MigrationVersion -file $file
  if (Test-MigrationApplied -containerName $dbContainer -version $version) {
    Write-Output "SKIP identity migration (ja aplicada): version=$version file=$($file.Name)"
    continue
  }

  Write-Output "APPLY identity migration: version=$version file=$($file.Name)"
  Apply-IdentityMigration -containerName $dbContainer -file $file
  Register-Migration -containerName $dbContainer -version $version -name ("identity_{0}" -f $file.BaseName)
  Write-Output "OK identity migration: version=$version file=$($file.Name)"
}

Write-Output "Identity migrations concluida."

