param(
  [string]$ClusterName = "knexit-local",
  [ValidateSet("base", "selfhost", "hybrid")]
  [string]$Profile = "base",
  [string]$KustomizePath = "",
  [string]$WebImage = "knexit-web:local",
  [switch]$SkipLoadLocalImages,
  [switch]$AutoBuildWebImageWhenMissing
)

$ErrorActionPreference = "Stop"

function Resolve-ToolPath([string]$Name, [string]$wingetSubpath) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }
  $pattern = Join-Path $env:LOCALAPPDATA "Microsoft\\WinGet\\Packages\\$wingetSubpath"
  $candidate = Get-ChildItem -Path $pattern -Filter "$Name.exe" -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
  return $candidate
}

function Invoke-Checked([string]$ToolPath, [string[]]$Arguments) {
  & $ToolPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    $joined = ($Arguments -join " ")
    throw "falha ao executar: $ToolPath $joined"
  }
}

function Test-DockerImageExists([string]$ImageTag) {
  $hasNativePreference = Test-Path variable:PSNativeCommandUseErrorActionPreference
  if ($hasNativePreference) {
    $previousNativePreference = $PSNativeCommandUseErrorActionPreference
  }
  $previousErrorActionPreference = $ErrorActionPreference

  try {
    $script:ErrorActionPreference = "Continue"
    if ($hasNativePreference) {
      $script:PSNativeCommandUseErrorActionPreference = $false
    }
    docker image inspect $ImageTag *> $null
    return $LASTEXITCODE -eq 0
  } finally {
    $script:ErrorActionPreference = $previousErrorActionPreference
    if ($hasNativePreference) {
      $script:PSNativeCommandUseErrorActionPreference = $previousNativePreference
    }
  }
}

function Ensure-LocalKindImages(
  [string]$ClusterNameValue,
  [string]$WebImageTag,
  [switch]$BuildWhenMissing
) {
  $buildScript = Join-Path $PSScriptRoot "kubernetes-build-local-images.ps1"
  $loadScript = Join-Path $PSScriptRoot "kubernetes-load-kind-images.ps1"

  if ($BuildWhenMissing -and -not (Test-DockerImageExists -ImageTag $WebImageTag)) {
    if (-not (Test-Path $buildScript)) {
      throw "script de build de imagens nao encontrado: $buildScript"
    }
    Invoke-Checked "powershell.exe" @("-ExecutionPolicy", "Bypass", "-File", $buildScript, "-WebImage", $WebImageTag)
  }

  if (-not (Test-Path $loadScript)) {
    throw "script de carga de imagens no kind nao encontrado: $loadScript"
  }
  Invoke-Checked "powershell.exe" @(
    "-ExecutionPolicy", "Bypass", "-File", $loadScript,
    "-ClusterName", $ClusterNameValue,
    "-WebImage", $WebImageTag
  )
}

function Test-DeploymentExists([string]$KubectlPath, [string]$Namespace, [string]$DeploymentName) {
  $hasNativePreference = Test-Path variable:PSNativeCommandUseErrorActionPreference
  if ($hasNativePreference) {
    $previousNativePreference = $PSNativeCommandUseErrorActionPreference
  }
  $previousErrorActionPreference = $ErrorActionPreference

  try {
    $script:ErrorActionPreference = "Continue"
    if ($hasNativePreference) {
      $script:PSNativeCommandUseErrorActionPreference = $false
    }
    & $KubectlPath @("-n", $Namespace, "get", "deployment", $DeploymentName) *> $null
    return $LASTEXITCODE -eq 0
  } finally {
    $script:ErrorActionPreference = $previousErrorActionPreference
    if ($hasNativePreference) {
      $script:PSNativeCommandUseErrorActionPreference = $previousNativePreference
    }
  }
}

function Wait-DeploymentRolloutIfExists(
  [string]$KubectlPath,
  [string]$Namespace,
  [string]$DeploymentName,
  [string]$Timeout
) {
  if (Test-DeploymentExists -KubectlPath $KubectlPath -Namespace $Namespace -DeploymentName $DeploymentName) {
    Invoke-Checked $KubectlPath @("-n", $Namespace, "rollout", "status", "deploy/$DeploymentName", "--timeout=$Timeout")
  } else {
    Write-Host "[skip] deployment/$DeploymentName nao existe no perfil aplicado."
  }
}

function Import-DotEnvFile([string]$DotEnvPath) {
  $values = @{}
  if (-not (Test-Path $DotEnvPath)) {
    return $values
  }

  foreach ($rawLine in Get-Content $DotEnvPath) {
    $line = $rawLine.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }
    if ($line.StartsWith("#")) {
      continue
    }

    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()

    if (($value.StartsWith("'") -and $value.EndsWith("'")) -or ($value.StartsWith('"') -and $value.EndsWith('"'))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$key] = $value
  }

  return $values
}

function Rewrite-LoopbackUrlForCluster([string]$value, [string]$replacementHost = "host.docker.internal") {
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $value
  }
  $rewrittenByRegex = [System.Text.RegularExpressions.Regex]::Replace(
    $value,
    "://(?:127\\.0\\.0\\.1|localhost)(?=[:/]|$)",
    "://$replacementHost",
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )
  if ($rewrittenByRegex -ne $value) {
    return $rewrittenByRegex
  }

  try {
    $uri = [System.Uri]$value
    if (-not $uri.IsAbsoluteUri) {
      return $value
    }
    $parsedHost = ""
    if (-not [string]::IsNullOrWhiteSpace($uri.Host)) {
      $parsedHost = $uri.Host.Trim().ToLowerInvariant()
    }
    if ($parsedHost -ne "127.0.0.1" -and $parsedHost -ne "localhost") {
      return $value
    }
    $builder = New-Object System.UriBuilder($uri)
    $builder.Host = $replacementHost
    return $builder.Uri.AbsoluteUri.TrimEnd("/")
  } catch {
    return $value
  }
}

function Rewrite-LoopbackHostForCluster([string]$value, [string]$replacementHost = "host.docker.internal") {
  $normalized = ""
  if (-not [string]::IsNullOrWhiteSpace($value)) {
    $normalized = $value.Trim().ToLowerInvariant()
  }
  if ($normalized -eq "127.0.0.1" -or $normalized -eq "localhost") {
    return $replacementHost
  }
  return $value
}

function Patch-SecretStringData([string]$KubectlPath, [string]$Namespace, [string]$SecretName, [hashtable]$StringData) {
  if ($StringData.Count -eq 0) {
    return
  }

  $patchPayload = @{ stringData = $StringData } | ConvertTo-Json -Compress -Depth 8
  $patchFile = New-TemporaryFile
  try {
    Set-Content -Path $patchFile -Value $patchPayload -Encoding utf8 -NoNewline
    & $KubectlPath @("-n", $Namespace, "patch", "secret", $SecretName, "--type=merge", "--patch-file", $patchFile) *> $null
    if ($LASTEXITCODE -ne 0) {
      throw "falha ao sincronizar segredos runtime no Kubernetes."
    }
  } finally {
    Remove-Item -Path $patchFile -Force -ErrorAction SilentlyContinue
  }
}

function Patch-ConfigMapData([string]$KubectlPath, [string]$Namespace, [string]$ConfigMapName, [hashtable]$Data) {
  if ($Data.Count -eq 0) {
    return
  }

  $patchPayload = @{ data = $Data } | ConvertTo-Json -Compress -Depth 8
  $patchFile = New-TemporaryFile
  try {
    Set-Content -Path $patchFile -Value $patchPayload -Encoding utf8 -NoNewline
    & $KubectlPath @("-n", $Namespace, "patch", "configmap", $ConfigMapName, "--type=merge", "--patch-file", $patchFile) *> $null
    if ($LASTEXITCODE -ne 0) {
      throw "falha ao sincronizar configuracao runtime no Kubernetes."
    }
  } finally {
    Remove-Item -Path $patchFile -Force -ErrorAction SilentlyContinue
  }
}

function Sync-KubernetesRuntimeEnvFromDotEnv([string]$KubectlPath, [string]$Namespace, [string]$DotEnvPath) {
  $dotEnv = Import-DotEnvFile -DotEnvPath $DotEnvPath
  if ($dotEnv.Count -eq 0) {
    Write-Host "[skip] .env.local nao encontrado ou vazio. Mantendo secret/configmap do kustomize."
    return
  }

  $secretKeys = @(
    "LOCAL_LLM_API_KEY",
    "VLLM_API_KEY",
    "EMBEDDING_API_KEY",
    "AI_SYSTEM_ANM_ENGINE_API_KEY",
    "HUGGING_FACE_HUB_TOKEN",
    "DATABASE_URL",
    "VECTOR_DATABASE_URL",
    "VECTOR_DB_HOST",
    "VECTOR_DB_PORT",
    "VECTOR_DB_NAME",
    "VECTOR_DB_USER",
    "VECTOR_DB_PASSWORD",
    "VECTOR_DB_SSL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "IDENTITY_SUPABASE_SERVICE_ROLE_KEY",
    "PUBLIC_API_KEY",
    "PUBLIC_API_KEYS"
  )
  $configMapKeys = @(
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_IDENTITY_SUPABASE_URL",
    "NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY",
    "EMBEDDING_MODEL_NAME",
    "EMBEDDING_MODEL",
    "VLLM_EMBEDDING_MODEL",
    "PUBLIC_API_ALLOWED_ORIGINS",
    "VERCEL_FRONTEND_ORIGIN"
  )

  $secretPatch = @{}
  foreach ($key in $secretKeys) {
    if ($dotEnv.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace([string]$dotEnv[$key])) {
      $value = [string]$dotEnv[$key]
      if ($key -eq "DATABASE_URL" -or $key -eq "VECTOR_DATABASE_URL") {
        $value = Rewrite-LoopbackUrlForCluster -value $value
      }
      if ($key -eq "VECTOR_DB_HOST") {
        $value = Rewrite-LoopbackHostForCluster -value $value
      }
      $secretPatch[$key] = $value
    }
  }

  $configMapPatch = @{}
  foreach ($key in $configMapKeys) {
    if ($dotEnv.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace([string]$dotEnv[$key])) {
      $configMapPatch[$key] = [string]$dotEnv[$key]
    }
  }

  if (
    -not $configMapPatch.ContainsKey("PUBLIC_API_ALLOWED_ORIGINS") -and
    -not $configMapPatch.ContainsKey("VERCEL_FRONTEND_ORIGIN") -and
    $dotEnv.ContainsKey("NEXT_PUBLIC_APP_URL") -and
    -not [string]::IsNullOrWhiteSpace([string]$dotEnv["NEXT_PUBLIC_APP_URL"])
  ) {
    $configMapPatch["PUBLIC_API_ALLOWED_ORIGINS"] = [string]$dotEnv["NEXT_PUBLIC_APP_URL"]
  }

  Patch-SecretStringData -KubectlPath $KubectlPath -Namespace $Namespace -SecretName "knexit-runtime-secrets" -StringData $secretPatch
  Patch-ConfigMapData -KubectlPath $KubectlPath -Namespace $Namespace -ConfigMapName "knexit-runtime-config" -Data $configMapPatch

  $secretCount = $secretPatch.Count
  $configCount = $configMapPatch.Count
  Write-Host "[ok] runtime synced from .env.local (secret=$secretCount, configmap=$configCount)."
}

docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "docker daemon indisponivel. Inicie/reinicie o Docker Desktop e tente novamente."
}

$kindPath = Resolve-ToolPath "kind" "Kubernetes.kind*"
if (-not $kindPath) {
  throw "kind nao encontrado. Rode scripts/install-kubernetes-tools.ps1 primeiro."
}

$kubectlPath = Resolve-ToolPath "kubectl" "Kubernetes.kubectl*"
if (-not $kubectlPath) {
  throw "kubectl nao encontrado. Rode scripts/install-kubernetes-tools.ps1 primeiro."
}

if ([string]::IsNullOrWhiteSpace($KustomizePath)) {
  switch ($Profile) {
    "hybrid" {
      $KustomizePath = "deploy/kubernetes-hybrid"
    }
    "selfhost" {
      $KustomizePath = "deploy/kubernetes-selfhost"
    }
    default {
      $KustomizePath = "deploy/kubernetes"
    }
  }
}

Write-Host "using kind: $kindPath"
Write-Host "using kubectl: $kubectlPath"

$clusters = & $kindPath get clusters
if ($LASTEXITCODE -ne 0) {
  throw "falha ao listar clusters kind. Verifique se o Docker daemon esta ativo."
}
if ($clusters -notcontains $ClusterName) {
  Invoke-Checked $kindPath @("create", "cluster", "--name", $ClusterName)
}

Invoke-Checked $kubectlPath @("config", "use-context", "kind-$ClusterName")
if (-not $SkipLoadLocalImages) {
  Ensure-LocalKindImages -ClusterNameValue $ClusterName -WebImageTag $WebImage -BuildWhenMissing:$AutoBuildWebImageWhenMissing
}
Invoke-Checked $kubectlPath @("apply", "-k", $KustomizePath)
$repoRoot = Split-Path -Parent $PSScriptRoot
$dotEnvPath = Join-Path $repoRoot ".env.local"
Sync-KubernetesRuntimeEnvFromDotEnv -KubectlPath $kubectlPath -Namespace "knexit" -DotEnvPath $dotEnvPath
Wait-DeploymentRolloutIfExists -KubectlPath $kubectlPath -Namespace "knexit" -DeploymentName "vllm" -Timeout "900s"
Wait-DeploymentRolloutIfExists -KubectlPath $kubectlPath -Namespace "knexit" -DeploymentName "knexit-web" -Timeout "300s"
Invoke-Checked $kubectlPath @("-n", "knexit", "get", "pods", "-o", "wide")

