param()

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$script:OkCount = 0
$script:WarnCount = 0
$script:FailCount = 0

function Write-Ok([string]$message) {
  $script:OkCount += 1
  Write-Output "[OK] $message"
}

function Write-Warn([string]$message) {
  $script:WarnCount += 1
  Write-Output "[WARN] $message"
}

function Write-Fail([string]$message) {
  $script:FailCount += 1
  Write-Output "[FAIL] $message"
}

function Import-EnvFile([string]$path) {
  if (-not (Test-Path $path)) {
    return
  }
  foreach ($line in Get-Content $path) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line.TrimStart().StartsWith("#")) { continue }
    $parts = $line.Split("=", 2)
    if ($parts.Count -ne 2) { continue }
    $name = $parts[0].Trim()
    if (-not $name) { continue }
    $value = $parts[1].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if ([string]::IsNullOrWhiteSpace((Get-Item "Env:$name" -ErrorAction SilentlyContinue).Value)) {
      Set-Item -Path "Env:$name" -Value $value
    }
  }
}

function Get-SupabaseProjectId {
  if (-not (Test-Path "supabase/config.toml" -PathType Leaf)) {
    return ""
  }
  $match = Select-String -Path "supabase/config.toml" -Pattern '^\s*project_id\s*=\s*"([^"]+)"' | Select-Object -First 1
  if (-not $match) {
    return ""
  }
  return $match.Matches[0].Groups[1].Value
}

function Invoke-WslTestPath([string]$path, [string]$testFlag) {
  $wsl = Get-Command wsl -ErrorAction SilentlyContinue
  if (-not $wsl) {
    return $false
  }
  $safe = $path.Replace("'", "'""'""'")
  & wsl -e bash -lc "test $testFlag '$safe'" 1>$null 2>$null
  return ($LASTEXITCODE -eq 0)
}

function Test-WslAvailable {
  return [bool](Get-Command wsl -ErrorAction SilentlyContinue)
}

function Is-PosixPath([string]$path) {
  return (-not [string]::IsNullOrWhiteSpace($path) -and $path.StartsWith("/"))
}

function Resolve-EffectivePath([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) {
    return $path
  }
  if ($path.StartsWith("/") -or [System.IO.Path]::IsPathRooted($path)) {
    return $path
  }
  return [System.IO.Path]::GetFullPath((Join-Path $repoRoot $path))
}

function Test-PathKind([string]$path, [ValidateSet("Any", "Directory", "File")] [string]$kind = "Any") {
  if ([string]::IsNullOrWhiteSpace($path)) {
    return @{ Exists = $false; External = $false }
  }

  if ($path.StartsWith("/")) {
    $flag = switch ($kind) {
      "Directory" { "-d" }
      "File" { "-f" }
      default { "-e" }
    }
    $ok = Invoke-WslTestPath -path $path -testFlag $flag
    return @{ Exists = $ok; External = $true }
  }

  if (-not (Test-Path $path)) {
    return @{ Exists = $false; External = $false }
  }
  if ($kind -eq "Directory") {
    return @{ Exists = (Test-Path $path -PathType Container); External = $false }
  }
  if ($kind -eq "File") {
    return @{ Exists = (Test-Path $path -PathType Leaf); External = $false }
  }
  return @{ Exists = $true; External = $false }
}

function Test-DirReadWrite([string]$path) {
  $probe = Join-Path $path ".nvme-verify-probe.$PID"
  try {
    Set-Content -Path $probe -Value "ok" -Encoding UTF8
    Get-Content -Path $probe -TotalCount 1 | Out-Null
    Remove-Item -Path $probe -Force -ErrorAction SilentlyContinue
    return $true
  } catch {
    try { Remove-Item -Path $probe -Force -ErrorAction SilentlyContinue } catch {}
    return $false
  }
}

function Check-ReadableDir([string]$label, [string]$rawPath) {
  $effective = Resolve-EffectivePath $rawPath
  $status = Test-PathKind -path $effective -kind "Directory"
  if (-not $status.Exists) {
    if ($status.External) {
      Write-Fail "$label inexistente no caminho POSIX: $effective"
    } else {
      Write-Fail "$label inexistente: $effective"
    }
    return
  }
  if (-not $status.External -and -not (Get-Item $effective).PSIsContainer) {
    Write-Fail "$label invalido (nao e diretorio): $effective"
    return
  }
  if (-not $status.External -and (Get-Item $effective).Attributes.ToString().Contains("ReparsePoint")) {
    Write-Warn "$label e symlink/reparse point: $effective"
  }
  Write-Ok "$label encontrado: $effective"
}

function Check-ReadableFile([string]$label, [string]$rawPath) {
  $effective = Resolve-EffectivePath $rawPath
  $status = Test-PathKind -path $effective -kind "File"
  if (-not $status.Exists) {
    if ($status.External) {
      Write-Fail "$label inexistente no caminho POSIX: $effective"
    } else {
      Write-Fail "$label inexistente: $effective"
    }
    return
  }
  if (-not $status.External) {
    try {
      Get-Content -Path $effective -TotalCount 1 | Out-Null
    } catch {
      Write-Fail "$label sem permissao de leitura: $effective"
      return
    }
  }
  Write-Ok "$label encontrado e legivel: $effective"
}

function Check-WritableOrCreatableDir([string]$label, [string]$rawPath) {
  $effective = Resolve-EffectivePath $rawPath
  $status = Test-PathKind -path $effective -kind "Directory"

  if ($status.Exists) {
    if ($status.External) {
      $safe = $effective.Replace("'", "'""'""'")
      & wsl -e bash -lc "probe='$safe/.nvme-verify-probe.$$'; printf ok > ""`$probe"" && cat ""`$probe"" >/dev/null && rm -f ""`$probe""" 1>$null 2>$null
      if ($LASTEXITCODE -eq 0) {
        Write-Ok "$label com leitura/escrita valida (POSIX): $effective"
      } else {
        Write-Fail "$label sem leitura/escrita (POSIX): $effective"
      }
      return
    }

    if (Test-DirReadWrite -path $effective) {
      Write-Ok "$label com leitura/escrita valida: $effective"
    } else {
      Write-Fail "$label sem leitura/escrita: $effective"
    }
    return
  }

  if ($status.External) {
    Write-Fail "$label ausente no caminho POSIX: $effective"
    return
  }

  $parent = Split-Path -Parent $effective
  if (-not $parent) { $parent = $repoRoot.Path }
  if (-not (Test-Path $parent -PathType Container)) {
    Write-Fail "$label ausente e diretorio pai inexistente: $effective"
    return
  }

  $probeParent = Join-Path $parent ".nvme-parent-probe.$PID"
  try {
    Set-Content -Path $probeParent -Value "ok" -Encoding UTF8
    Remove-Item -Path $probeParent -Force -ErrorAction SilentlyContinue
    Write-Warn "$label nao existe, mas pode ser criado: $effective"
  } catch {
    Write-Fail "$label nao existe e nao pode ser criado: $effective"
  }
}

Import-EnvFile ".env"
Import-EnvFile ".env.local"

$migrationsPath = if ($env:MIGRATIONS_PATH) { $env:MIGRATIONS_PATH } else { "supabase/migrations" }
$knexAiMigrationFile = if ($env:KNEXAI_MIGRATION_FILE) { $env:KNEXAI_MIGRATION_FILE } else { Join-Path $migrationsPath "20260302195000_create_knexai_unified_local.sql" }
$vectorMigrationFile = if ($env:VECTOR_MIGRATION_FILE) { $env:VECTOR_MIGRATION_FILE } else { Join-Path $migrationsPath "20260303120000_create_rag_base_schema.sql" }
$vectorIndexMigrationFile = if ($env:VECTOR_HNSW_MIGRATION_FILE) { $env:VECTOR_HNSW_MIGRATION_FILE } else { Join-Path $migrationsPath "20260303130000_add_hnsw_index_chunk_embeddings.sql" }
$legacyMigrationsPath = if ($env:LEGACY_MIGRATIONS_PATH) { $env:LEGACY_MIGRATIONS_PATH } else { "supabase/migrations_legacy" }
$storageBasePath = if ($env:STORAGE_BASE_PATH) { $env:STORAGE_BASE_PATH } else { "data" }
$documentsBasePath = if ($env:DOCUMENTS_BASE_PATH) { $env:DOCUMENTS_BASE_PATH } else { "docs" }
$embeddingsBasePath = if ($env:EMBEDDINGS_BASE_PATH) { $env:EMBEDDINGS_BASE_PATH } else { "models" }
$localLlmModelDefault = if ($env:LOCAL_LLM_MODEL_DEFAULT) { $env:LOCAL_LLM_MODEL_DEFAULT } else { "$embeddingsBasePath/CModelosMistral-7B-Instruct-v0.2-AWQ" }
$tempWorkdirPath = if ($env:TEMP_WORKDIR_PATH) { $env:TEMP_WORKDIR_PATH } else { ".tmp" }
$exportsBasePath = if ($env:EXPORTS_BASE_PATH) { $env:EXPORTS_BASE_PATH } else { "data/exports" }
$anmCheckpointDir = if ($env:ANM_CHECKPOINT_DIR) { $env:ANM_CHECKPOINT_DIR } else { "anm_backend/data/checkpoints" }
$ragRawDocumentsPath = if ($env:RAG_RAW_DOCUMENTS_PATH) { $env:RAG_RAW_DOCUMENTS_PATH } else { "$storageBasePath/rag/raw" }
$ragExtractedTextPath = if ($env:RAG_EXTRACTED_TEXT_PATH) { $env:RAG_EXTRACTED_TEXT_PATH } else { "$storageBasePath/rag/text" }
$ragAdminBulkBasePath = if ($env:RAG_ADMIN_BULK_BASE_PATH) { $env:RAG_ADMIN_BULK_BASE_PATH } else { "$storageBasePath/rag/bulk" }
$dockerTemplatePath = if ($env:DOCKER_ENGINE_TEMPLATE_PATH) { $env:DOCKER_ENGINE_TEMPLATE_PATH } else { "infra/docker/docker-desktop-engine.nvme2.json" }
$dockerDataRoot = if ($env:DOCKER_DATA_ROOT) { $env:DOCKER_DATA_ROOT } else { "/var/lib/docker" }
$identityMigrationsPolicy = if ($env:IDENTITY_MIGRATIONS_POLICY) { $env:IDENTITY_MIGRATIONS_POLICY } else { "required" }
$anmCheckpointRetentionDays = if ($env:ANM_CHECKPOINT_RETENTION_DAYS) { $env:ANM_CHECKPOINT_RETENTION_DAYS } else { "14" }
$exportsRetentionDays = if ($env:EXPORTS_RETENTION_DAYS) { $env:EXPORTS_RETENTION_DAYS } else { "60" }

Write-Output "[INFO] MIGRATIONS_PATH=$migrationsPath"
Write-Output "[INFO] KNEXAI_MIGRATION_FILE=$knexAiMigrationFile"
Write-Output "[INFO] VECTOR_MIGRATION_FILE=$vectorMigrationFile"
Write-Output "[INFO] VECTOR_HNSW_MIGRATION_FILE=$vectorIndexMigrationFile"
Write-Output "[INFO] ANM_CHECKPOINT_DIR=$anmCheckpointDir"
Write-Output "[INFO] STORAGE_BASE_PATH=$storageBasePath"
Write-Output "[INFO] TEMP_WORKDIR_PATH=$tempWorkdirPath"
Write-Output "[INFO] EXPORTS_BASE_PATH=$exportsBasePath"
Write-Output "[INFO] RAG_RAW_DOCUMENTS_PATH=$ragRawDocumentsPath"
Write-Output "[INFO] RAG_EXTRACTED_TEXT_PATH=$ragExtractedTextPath"
Write-Output "[INFO] RAG_ADMIN_BULK_BASE_PATH=$ragAdminBulkBasePath"
Write-Output "[INFO] DOCUMENTS_BASE_PATH=$documentsBasePath"
Write-Output "[INFO] EMBEDDINGS_BASE_PATH=$embeddingsBasePath"
Write-Output "[INFO] LOCAL_LLM_MODEL_DEFAULT=$localLlmModelDefault"
Write-Output "[INFO] DOCKER_ENGINE_TEMPLATE_PATH=$dockerTemplatePath"
Write-Output "[INFO] DOCKER_DATA_ROOT=$dockerDataRoot"
Write-Output "[INFO] IDENTITY_MIGRATIONS_POLICY=$identityMigrationsPolicy"
Write-Output "[INFO] ANM_CHECKPOINT_RETENTION_DAYS=$anmCheckpointRetentionDays"
Write-Output "[INFO] EXPORTS_RETENTION_DAYS=$exportsRetentionDays"

$posixCandidates = @($env:NVME_BASE_PATH, $knexAiMigrationFile, $anmCheckpointDir, $dockerDataRoot, $env:ANM_WSL_WORKSPACE_DIR)
$hasPosixPath = $false
foreach ($candidate in $posixCandidates) {
  if (Is-PosixPath $candidate) {
    $hasPosixPath = $true
    break
  }
}
if ($hasPosixPath -and -not (Test-WslAvailable)) {
  Write-Fail "WSL indisponivel com paths POSIX configurados. Instale/habilite WSL ou use paths Windows equivalentes."
}

if ($env:NVME_BASE_PATH) {
  $nvmePath = Resolve-EffectivePath $env:NVME_BASE_PATH
  $nvmeStatus = Test-PathKind -path $nvmePath -kind "Directory"
  if ($nvmeStatus.Exists) {
    Write-Ok "NVME_BASE_PATH encontrado: $nvmePath"
  } else {
    Write-Fail "NVME_BASE_PATH configurado, mas inexistente: $nvmePath"
  }
} else {
  Write-Warn "NVME_BASE_PATH nao definido (fallback para paths relativos)."
}

$checkpointRetentionValue = 0
$checkpointRetentionOk = [int]::TryParse($anmCheckpointRetentionDays, [ref]$checkpointRetentionValue)
$exportsRetentionValue = 0
$exportsRetentionOk = [int]::TryParse($exportsRetentionDays, [ref]$exportsRetentionValue)
if (@("required", "optional") -notcontains $identityMigrationsPolicy) {
  Write-Fail "IDENTITY_MIGRATIONS_POLICY invalido: $identityMigrationsPolicy (use required|optional)"
}
if (-not $checkpointRetentionOk -or $checkpointRetentionValue -le 0) {
  Write-Fail "ANM_CHECKPOINT_RETENTION_DAYS invalido: $anmCheckpointRetentionDays"
}
if (-not $exportsRetentionOk -or $exportsRetentionValue -le 0) {
  Write-Fail "EXPORTS_RETENTION_DAYS invalido: $exportsRetentionDays"
}

Check-ReadableDir "Diretorio de migrations" $migrationsPath
Check-ReadableFile "Migration unificada KnexAI" $knexAiMigrationFile
Check-ReadableFile "Migration pgvector" $vectorMigrationFile
Check-ReadableFile "Migration HNSW" $vectorIndexMigrationFile
Check-ReadableDir "Diretorio de migrations legadas" $legacyMigrationsPath
Check-ReadableDir "Diretorio de documentos" $documentsBasePath
Check-ReadableDir "Diretorio de modelos" $embeddingsBasePath
Check-ReadableFile "Template Docker Engine" $dockerTemplatePath

Check-WritableOrCreatableDir "Storage base" $storageBasePath
Check-WritableOrCreatableDir "Diretorio temporario persistente" $tempWorkdirPath
Check-WritableOrCreatableDir "Diretorio de exportacoes" $exportsBasePath
Check-WritableOrCreatableDir "Checkpoint ANM" $anmCheckpointDir
Check-WritableOrCreatableDir "Diretorio RAG de documentos brutos" $ragRawDocumentsPath
Check-WritableOrCreatableDir "Diretorio RAG de texto extraido" $ragExtractedTextPath
Check-WritableOrCreatableDir "Diretorio RAG de ingestao em massa" $ragAdminBulkBasePath

$templateAbs = Resolve-EffectivePath $dockerTemplatePath
$templateStatus = Test-PathKind -path $templateAbs -kind "File"
if ($templateStatus.Exists -and -not $templateStatus.External) {
  try {
    $templateJson = Get-Content -Path $templateAbs -Raw | ConvertFrom-Json
    $templateDataRoot = [string]$templateJson.'data-root'
    if ([string]::IsNullOrWhiteSpace($templateDataRoot)) {
      Write-Fail "Template Docker Engine sem 'data-root': $templateAbs"
    } elseif ($templateDataRoot -ne $dockerDataRoot) {
      Write-Fail "Template Docker Engine diverge de DOCKER_DATA_ROOT (template='$templateDataRoot' esperado='$dockerDataRoot')."
    } else {
      Write-Ok "Template Docker Engine consistente com DOCKER_DATA_ROOT."
    }
  } catch {
    Write-Fail "Template Docker Engine invalido (JSON): $templateAbs"
  }
}

$daemonPath = Join-Path $env:USERPROFILE ".docker\daemon.json"
if (Test-Path $daemonPath -PathType Leaf) {
  try {
    $daemonJson = Get-Content -Path $daemonPath -Raw | ConvertFrom-Json
    $daemonDataRoot = [string]$daemonJson.'data-root'
    if ([string]::IsNullOrWhiteSpace($daemonDataRoot)) {
      Write-Warn "daemon.json sem 'data-root' explicito: $daemonPath"
    } elseif ($daemonDataRoot -ne $dockerDataRoot) {
      Write-Fail "daemon.json diverge de DOCKER_DATA_ROOT (daemon='$daemonDataRoot' esperado='$dockerDataRoot')."
    } else {
      Write-Ok "daemon.json consistente com DOCKER_DATA_ROOT."
    }
  } catch {
    Write-Fail "daemon.json invalido (JSON): $daemonPath"
  }
} else {
  Write-Warn "daemon.json ausente em $daemonPath (estado do host nao versionado)."
}

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
  Write-Fail "Docker CLI indisponivel no host."
} else {
  $dockerRoot = (& docker info --format "{{.DockerRootDir}}" 2>$null | Out-String).Trim()
  if ([string]::IsNullOrWhiteSpace($dockerRoot)) {
    Write-Fail "Nao foi possivel ler DockerRootDir (docker daemon indisponivel)."
  } elseif ($dockerRoot -ne $dockerDataRoot) {
    Write-Fail "DockerRootDir diverge de DOCKER_DATA_ROOT (runtime='$dockerRoot' esperado='$dockerDataRoot')."
  } else {
    Write-Ok "DockerRootDir consistente com DOCKER_DATA_ROOT."
  }
}

$migrationsAbs = Resolve-EffectivePath $migrationsPath
$knexMigrationAbs = Resolve-EffectivePath $knexAiMigrationFile
$vectorMigrationAbs = Resolve-EffectivePath $vectorMigrationFile
$vectorIndexMigrationAbs = Resolve-EffectivePath $vectorIndexMigrationFile
if ($knexMigrationAbs.StartsWith("/")) {
  $safeMigDir = $migrationsAbs.Replace("'", "'""'""'")
  $safeMigFile = $knexMigrationAbs.Replace("'", "'""'""'")
  & wsl -e bash -lc "case '$safeMigFile' in '$safeMigDir'/*) exit 0 ;; *) exit 1 ;; esac" 1>$null 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Ok "KNEXAI_MIGRATION_FILE consistente com MIGRATIONS_PATH."
  } else {
    Write-Warn "KNEXAI_MIGRATION_FILE fora de MIGRATIONS_PATH."
  }
} else {
  if ($knexMigrationAbs.StartsWith($migrationsAbs)) {
    Write-Ok "KNEXAI_MIGRATION_FILE consistente com MIGRATIONS_PATH."
  } else {
    Write-Warn "KNEXAI_MIGRATION_FILE fora de MIGRATIONS_PATH."
  }
}

if ($vectorMigrationAbs.StartsWith("/")) {
  $safeMigDir = $migrationsAbs.Replace("'", "'""'""'")
  $safeMigFile = $vectorMigrationAbs.Replace("'", "'""'""'")
  & wsl -e bash -lc "case '$safeMigFile' in '$safeMigDir'/*) exit 0 ;; *) exit 1 ;; esac" 1>$null 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Ok "VECTOR_MIGRATION_FILE consistente com MIGRATIONS_PATH."
  } else {
    Write-Warn "VECTOR_MIGRATION_FILE fora de MIGRATIONS_PATH."
  }
} else {
  if ($vectorMigrationAbs.StartsWith($migrationsAbs)) {
    Write-Ok "VECTOR_MIGRATION_FILE consistente com MIGRATIONS_PATH."
  } else {
    Write-Warn "VECTOR_MIGRATION_FILE fora de MIGRATIONS_PATH."
  }
}

if ($vectorIndexMigrationAbs.StartsWith("/")) {
  $safeMigDir = $migrationsAbs.Replace("'", "'""'""'")
  $safeMigFile = $vectorIndexMigrationAbs.Replace("'", "'""'""'")
  & wsl -e bash -lc "case '$safeMigFile' in '$safeMigDir'/*) exit 0 ;; *) exit 1 ;; esac" 1>$null 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Ok "VECTOR_HNSW_MIGRATION_FILE consistente com MIGRATIONS_PATH."
  } else {
    Write-Warn "VECTOR_HNSW_MIGRATION_FILE fora de MIGRATIONS_PATH."
  }
} else {
  if ($vectorIndexMigrationAbs.StartsWith($migrationsAbs)) {
    Write-Ok "VECTOR_HNSW_MIGRATION_FILE consistente com MIGRATIONS_PATH."
  } else {
    Write-Warn "VECTOR_HNSW_MIGRATION_FILE fora de MIGRATIONS_PATH."
  }
}

if (Test-Path "supabase/config.toml" -PathType Leaf) {
  Write-Ok "Estrutura supabase/config.toml presente."
} else {
  Write-Fail "Arquivo supabase/config.toml ausente."
}

$identityPath = "supabase/identity/migrations"
if (Test-Path $identityPath -PathType Container) {
  Write-Ok "Diretorio de migrations de identidade presente."
  $identityFiles = Get-ChildItem -Path $identityPath -Filter "*.sql" -File | Sort-Object Name
  if (-not $identityFiles -or $identityFiles.Count -eq 0) {
    Write-Warn "Diretorio de identidade sem arquivos .sql: $identityPath"
  } else {
    $projectId = Get-SupabaseProjectId
    if ([string]::IsNullOrWhiteSpace($projectId)) {
      Write-Fail "Nao foi possivel resolver project_id para validar migrations de identidade."
    } else {
      $dbContainer = "supabase_db_$projectId"
      $running = (& docker ps --format "{{.Names}}" | Select-String -Pattern ("^{0}$" -f [regex]::Escape($dbContainer)) -Quiet)
      if (-not $running) {
        if ($identityMigrationsPolicy -eq "required") {
          Write-Fail "Container do Supabase local indisponivel para validar identity migrations: $dbContainer"
        } else {
          Write-Warn "Container do Supabase local indisponivel para validar identity migrations: $dbContainer"
        }
      } else {
        foreach ($file in $identityFiles) {
          $match = [regex]::Match($file.BaseName, '^(\d+)_')
          if (-not $match.Success) {
            Write-Fail "Identity migration sem prefixo numerico: $($file.Name)"
            continue
          }
          $version = $match.Groups[1].Value
          $exists = (& docker exec $dbContainer psql -U postgres -d postgres -Atc "select 1 from supabase_migrations.schema_migrations where version='$version' limit 1;" 2>$null | Out-String).Trim()
          if ($exists -eq "1") {
            Write-Ok "Identity migration aplicada: version=$version file=$($file.Name)"
          } else {
            if ($identityMigrationsPolicy -eq "required") {
              Write-Fail "Identity migration pendente: version=$version file=$($file.Name)"
            } else {
              Write-Warn "Identity migration pendente: version=$version file=$($file.Name)"
            }
          }
        }
      }
    }
  }
} else {
  Write-Warn "Diretorio de migrations de identidade ausente: $identityPath"
}

try {
  $projectIdForVector = Get-SupabaseProjectId
  $vectorDbContainer = "supabase_db_$projectIdForVector"
  $vectorDbRunning = (& docker ps --format "{{.Names}}" | Select-String -Pattern ("^{0}$" -f [regex]::Escape($vectorDbContainer)) -Quiet)
  if (-not $vectorDbRunning) {
    Write-Fail "Container do Supabase local indisponivel para validar extensao vector: $vectorDbContainer"
  } else {
    $hasVector = (& docker exec $vectorDbContainer psql -U postgres -d postgres -Atc "select 1 from pg_extension where extname='vector' limit 1;" 2>$null | Out-String).Trim()
    if ($hasVector -eq "1") {
      Write-Ok "Extensao pgvector habilitada no banco local."
    } else {
      Write-Fail "Extensao pgvector ausente no banco local (esperado: CREATE EXTENSION vector)."
    }

    $requiredRagTables = @(
      "vector_store.document_sources",
      "vector_store.documents",
      "vector_store.document_chunks",
      "vector_store.chunk_embeddings",
      "vector_store.ingestion_jobs"
    )
    foreach ($tableName in $requiredRagTables) {
      $exists = (& docker exec $vectorDbContainer psql -U postgres -d postgres -Atc "select to_regclass('$tableName') is not null;" 2>$null | Out-String).Trim().ToLowerInvariant()
      if ($exists -eq "t" -or $exists -eq "true") {
        Write-Ok "Tabela RAG presente: $tableName"
      } else {
        Write-Fail "Tabela RAG ausente: $tableName"
      }
    }

    $hasHnswIndex = (& docker exec $vectorDbContainer psql -U postgres -d postgres -Atc "select to_regclass('vector_store.chunk_embeddings_embedding_hnsw_cosine_idx') is not null;" 2>$null | Out-String).Trim().ToLowerInvariant()
    if ($hasHnswIndex -eq "t" -or $hasHnswIndex -eq "true") {
      Write-Ok "Indice HNSW presente: vector_store.chunk_embeddings_embedding_hnsw_cosine_idx"
    } else {
      Write-Fail "Indice HNSW ausente: vector_store.chunk_embeddings_embedding_hnsw_cosine_idx"
    }
  }
} catch {
  Write-Fail "Falha ao validar extensao pgvector: $($_.Exception.Message)"
}

Write-Output ""
Write-Output ("Resumo: ok={0} warn={1} fail={2}" -f $script:OkCount, $script:WarnCount, $script:FailCount)
if ($script:FailCount -gt 0) {
  exit 1
}
exit 0
