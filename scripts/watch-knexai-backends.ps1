param(
  [int]$IntervalSeconds = 20,
  [switch]$Once,
  [switch]$AllowMultipleInstances,
  [switch]$DisableRestartAlert,
  [string]$AlertLogPath = "",
  [int]$AlertCooldownSeconds = 120,
  [int]$AlertPopupTimeoutSeconds = 8,
  [string]$WebhookUrl = "",
  [string]$WebhookProvider = "auto",
  [int]$WebhookTimeoutSeconds = 5,
  [switch]$DisableDockerWatch,
  [int]$DockerRestartCooldownSeconds = 300,
  [int]$DockerCliTimeoutSeconds = 12,
  [int]$DockerStartupGraceSeconds = 20,
  [string]$DockerDesktopExePath = "",
  [switch]$DisableVectorDbProbe,
  [string]$VectorDatabaseUrl = "",
  [int]$VectorDbProbeTimeoutMs = 1200,
  [switch]$DisableVllmWatch,
  [int]$VllmRestartCooldownSeconds = 120,
  [switch]$DisableEmbeddingsWatch,
  [string]$EmbeddingsHealthUrl = "",
  [int]$EmbeddingsRestartCooldownSeconds = 120,
  [switch]$DisableKubernetesWatch,
  [string]$KubernetesNamespace = "knexit",
  [string]$KubernetesDeploymentName = "knexit-web",
  [string]$KubernetesPodLabelSelector = "app=knexit-web",
  [string]$KubernetesClusterName = "knexit-local",
  [string]$KubernetesWebImage = "knexit-web:local",
  [int]$KubernetesRestartCooldownSeconds = 180,
  [int]$KubernetesRolloutTimeoutSeconds = 120,
  [switch]$DisableKubernetesAutoLoadImages,
  [switch]$KubernetesAutoBuildWebImageWhenMissing
)

$ErrorActionPreference = "Stop"
$script:DotEnvLoaded = $false
$script:DotEnvValues = @{}
$script:LastAlertAtByKey = @{}
$script:LastRecoveryAtByBackend = @{
  "docker" = [DateTime]::MinValue
  "vllm" = [DateTime]::MinValue
  "embeddings" = [DateTime]::MinValue
  "k8s" = [DateTime]::MinValue
}
$script:OneTimeNotices = @{}
$script:KubectlPath = ""

function Join-ScriptPath([string]$scriptName) {
  return Join-Path $PSScriptRoot $scriptName
}

function Write-OnceNotice {
  param(
    [string]$Key,
    [string]$Message
  )

  if (-not $script:OneTimeNotices.ContainsKey($Key)) {
    $script:OneTimeNotices[$Key] = $true
    Write-Host $Message
  }
}

function Get-WatchdogSiblingProcesses {
  param(
    [int]$CurrentPid
  )
  try {
    $pattern = "watch-knexai-backends\.ps1"
    return @(
      Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.ProcessId -ne $CurrentPid -and
        $_.CommandLine -and
        $_.CommandLine -match $pattern
      }
    )
  } catch {
    return @()
  }
}

function Test-Health([string]$url, [int]$timeoutSec = 3) {
  try {
    $response = Invoke-WebRequest -Uri $url -TimeoutSec $timeoutSec
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
  } catch {
    return $false
  }
}

function Find-ProcessByPattern([string]$pattern) {
  try {
    return @(
      Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -and $_.CommandLine -match $pattern
      }
    )
  } catch {
    return @()
  }
}

function Start-DetachedPowerShellScript {
  param(
    [string]$ScriptPath,
    [string[]]$ExtraArgs = @()
  )

  $argumentList = @("-ExecutionPolicy", "Bypass", "-File", $ScriptPath)
  if ($ExtraArgs -and $ExtraArgs.Count -gt 0) {
    $argumentList += $ExtraArgs
  }

  Start-Process -FilePath "powershell.exe" -ArgumentList $argumentList -WindowStyle Minimized | Out-Null
}

function Resolve-AlertLogPath {
  param(
    [string]$ConfiguredPath
  )

  if (-not [string]::IsNullOrWhiteSpace($ConfiguredPath)) {
    return $ConfiguredPath
  }
  $defaultDir = Join-Path $env:LOCALAPPDATA "KnexIT"
  return Join-Path $defaultDir "watchdog-backends-alert.log"
}

function Get-DotEnvPath {
  $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
  return Join-Path $repoRoot.Path ".env.local"
}

function Load-DotEnvValues {
  if ($script:DotEnvLoaded) {
    return
  }
  $script:DotEnvLoaded = $true
  $script:DotEnvValues = @{}
  $dotenvPath = Get-DotEnvPath

  if (-not (Test-Path $dotenvPath)) {
    return
  }

  try {
    $lines = Get-Content -Path $dotenvPath -ErrorAction Stop
    foreach ($raw in $lines) {
      $line = "$raw".Trim()
      if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
        continue
      }
      if ($line.StartsWith("export ")) {
        $line = $line.Substring(7).Trim()
      }
      $eqIndex = $line.IndexOf("=")
      if ($eqIndex -lt 1) {
        continue
      }
      $key = $line.Substring(0, $eqIndex).Trim()
      $value = $line.Substring($eqIndex + 1).Trim()
      if ((($value.StartsWith('"')) -and ($value.EndsWith('"'))) -or (($value.StartsWith("'")) -and ($value.EndsWith("'")))) {
        if ($value.Length -ge 2) {
          $value = $value.Substring(1, $value.Length - 2)
        }
      }
      if (-not [string]::IsNullOrWhiteSpace($key)) {
        $script:DotEnvValues[$key] = $value
      }
    }
  } catch {
    Write-Warning "[watchdog] Falha ao carregar .env.local: $($_.Exception.Message)"
  }
}

function Get-DotEnvValue {
  param(
    [string]$Name
  )

  Load-DotEnvValues
  if ($script:DotEnvValues.ContainsKey($Name)) {
    return "$($script:DotEnvValues[$Name])"
  }
  return ""
}

function Get-FirstNonEmpty {
  param(
    [string[]]$Candidates
  )

  foreach ($candidate in $Candidates) {
    if (-not [string]::IsNullOrWhiteSpace($candidate)) {
      return $candidate.Trim()
    }
  }
  return ""
}

function Invoke-ProcessWithTimeout {
  param(
    [string]$FilePath,
    [string[]]$Arguments = @(),
    [int]$TimeoutSeconds = 12
  )

  $stdoutFile = [System.IO.Path]::GetTempFileName()
  $stderrFile = [System.IO.Path]::GetTempFileName()
  $argumentLine = [string]::Join(" ", @($Arguments | ForEach-Object { "$_" }))
  $process = $null
  $timedOut = $false

  try {
    $process = Start-Process -FilePath $FilePath -ArgumentList $argumentLine -PassThru -NoNewWindow -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
    $waitMs = [Math]::Max(1000, $TimeoutSeconds * 1000)
    if (-not $process.WaitForExit($waitMs)) {
      $timedOut = $true
      try {
        $process.Kill()
      } catch {
        # ignore
      }
    }

    $stdoutLines = @()
    $stderrLines = @()
    if (Test-Path $stdoutFile) {
      $stdoutLines = @(Get-Content $stdoutFile -ErrorAction SilentlyContinue)
    }
    if (Test-Path $stderrFile) {
      $stderrLines = @(Get-Content $stderrFile -ErrorAction SilentlyContinue)
    }
    $stdout = [string]::Join([Environment]::NewLine, @($stdoutLines | ForEach-Object { "$_" }))
    $stderr = [string]::Join([Environment]::NewLine, @($stderrLines | ForEach-Object { "$_" }))
    $exitCode = if ($timedOut) { -1 } else { $process.ExitCode }
    return @{
      TimedOut = $timedOut
      ExitCode = $exitCode
      StdOut = $stdout
      StdErr = $stderr
    }
  } catch {
    return @{
      TimedOut = $false
      ExitCode = -2
      StdOut = ""
      StdErr = $_.Exception.Message
    }
  } finally {
    try { Remove-Item $stdoutFile -Force -ErrorAction SilentlyContinue } catch {}
    try { Remove-Item $stderrFile -Force -ErrorAction SilentlyContinue } catch {}
  }
}

function Resolve-DockerDesktopExecutable {
  if (-not [string]::IsNullOrWhiteSpace($DockerDesktopExePath) -and (Test-Path $DockerDesktopExePath)) {
    return $DockerDesktopExePath
  }

  $candidate = Get-FirstNonEmpty @(
    $env:DOCKER_DESKTOP_EXE,
    (Get-DotEnvValue -Name "DOCKER_DESKTOP_EXE"),
    "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  )
  if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path $candidate)) {
    return $candidate
  }
  return ""
}

function Get-DockerRuntimeProcesses {
  try {
    return @(
      Get-Process -Name "Docker Desktop", "com.docker.backend", "com.docker.vmm", "vpnkit-bridge", "docker" -ErrorAction SilentlyContinue
    )
  } catch {
    return @()
  }
}

function Stop-DockerRuntimeProcesses {
  $processes = Get-DockerRuntimeProcesses
  foreach ($proc in $processes) {
    try {
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    } catch {
      # ignore
    }
  }
}

function Invoke-WslCleanupForDocker {
  $commands = @(
    @("--terminate", "docker-desktop"),
    @("--terminate", "docker-desktop-data"),
    @("--shutdown")
  )
  foreach ($args in $commands) {
    try {
      [void](Invoke-ProcessWithTimeout -FilePath "wsl.exe" -Arguments $args -TimeoutSeconds 15)
    } catch {
      # ignore
    }
  }
}

function Get-SystemDriveFreeGb {
  try {
    $drive = Get-PSDrive -Name C -ErrorAction Stop
    return [math]::Round(($drive.Free / 1GB), 2)
  } catch {
    return -1
  }
}

function Test-DockerEngineHealthy {
  $result = Invoke-ProcessWithTimeout -FilePath "docker" -Arguments @("version") -TimeoutSeconds $DockerCliTimeoutSeconds
  if ($result.TimedOut) {
    return @{
      Ok = $false
      Reason = "docker_version_timeout_${DockerCliTimeoutSeconds}s"
      Detail = ""
    }
  }

  $combinedOutput = [string]::Join([Environment]::NewLine, @("$($result.StdOut)", "$($result.StdErr)"))
  $failurePattern = "(?i)failed to connect|cannot connect|daemon is not running|context deadline exceeded|open //\./pipe|error during connect|Internal Server Error"
  $hasFailureText = $combinedOutput -match $failurePattern
  $hasServerSection = $combinedOutput -match "(?m)^Server:"

  if ($hasServerSection -and -not $hasFailureText) {
    return @{
      Ok = $true
      Reason = "ok"
      Detail = "server_responsive"
    }
  }

  if ($result.ExitCode -ne 0) {
    $detail = Get-FirstNonEmpty @($result.StdErr, $result.StdOut, "docker_version_exit_$($result.ExitCode)")
    $normalized = "$detail".Trim()
    if ([string]::IsNullOrWhiteSpace($normalized)) {
      $normalized = "docker_version_exit_$($result.ExitCode)"
    }
    return @{
      Ok = $false
      Reason = "docker_version_failure"
      Detail = $normalized
    }
  }

  if ($hasFailureText) {
    return @{
      Ok = $false
      Reason = "docker_failure_pattern_detected"
      Detail = "$($combinedOutput)".Trim()
    }
  }

  if ($combinedOutput -notmatch "(?m)^Server:") {
    return @{
      Ok = $false
      Reason = "docker_server_section_missing"
      Detail = "$($result.StdOut)".Trim()
    }
  }

  return @{
    Ok = $true
    Reason = "ok"
    Detail = "server_responsive"
  }
}

function Resolve-VectorDbProbeTarget {
  if ($DisableVectorDbProbe) {
    return @{
      Enabled = $false
      Host = ""
      Port = 0
      Source = "disabled"
    }
  }

  $connectionString = Get-FirstNonEmpty @(
    $VectorDatabaseUrl,
    $env:VECTOR_DATABASE_URL,
    (Get-DotEnvValue -Name "VECTOR_DATABASE_URL")
  )
  if ([string]::IsNullOrWhiteSpace($connectionString)) {
    return @{
      Enabled = $false
      Host = ""
      Port = 0
      Source = "missing_url"
    }
  }

  try {
    $uri = [System.Uri]$connectionString
    $port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
    return @{
      Enabled = $true
      Host = $uri.Host
      Port = $port
      Source = "VECTOR_DATABASE_URL"
    }
  } catch {
    return @{
      Enabled = $false
      Host = ""
      Port = 0
      Source = "invalid_url"
    }
  }
}

function Test-TcpEndpoint {
  param(
    [string]$TargetHost,
    [int]$Port,
    [int]$TimeoutMs = 1200
  )

  if ([string]::IsNullOrWhiteSpace($TargetHost) -or $Port -le 0) {
    return $false
  }

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $client.BeginConnect($TargetHost, $Port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne($TimeoutMs)) {
      return $false
    }
    $client.EndConnect($iar) | Out-Null
    return $true
  } catch {
    return $false
  } finally {
    try {
      $client.Close()
    } catch {
      # ignore
    }
  }
}

function Resolve-WebhookUrl {
  param(
    [string]$ConfiguredUrl
  )

  return Get-FirstNonEmpty @(
    $ConfiguredUrl,
    $env:KNEXIT_WATCHDOG_WEBHOOK_URL,
    (Get-DotEnvValue -Name "KNEXIT_WATCHDOG_WEBHOOK_URL"),
    $env:WATCHDOG_WEBHOOK_URL,
    (Get-DotEnvValue -Name "WATCHDOG_WEBHOOK_URL")
  )
}

function Resolve-WebhookProvider {
  param(
    [string]$ConfiguredProvider,
    [string]$EffectiveWebhookUrl
  )

  $provider = (Get-FirstNonEmpty @(
    $ConfiguredProvider,
    $env:KNEXIT_WATCHDOG_WEBHOOK_PROVIDER,
    (Get-DotEnvValue -Name "KNEXIT_WATCHDOG_WEBHOOK_PROVIDER"),
    $env:WATCHDOG_WEBHOOK_PROVIDER,
    (Get-DotEnvValue -Name "WATCHDOG_WEBHOOK_PROVIDER")
  )).ToLowerInvariant()

  if ([string]::IsNullOrWhiteSpace($provider)) {
    $provider = "auto"
  }

  if ($provider -eq "auto") {
    try {
      $uri = [System.Uri]$EffectiveWebhookUrl
      $host = $uri.Host.ToLowerInvariant()
      if ($host -like "*discord.com" -or $host -like "*discordapp.com") {
        return "discord"
      }
      if ($host -like "*slack.com") {
        return "slack"
      }
    } catch {
      # Keep default provider below when URL parsing fails.
    }
    return "slack"
  }

  if ($provider -eq "discord" -or $provider -eq "slack") {
    return $provider
  }

  return "slack"
}

function Send-RestartWebhook {
  param(
    [string]$Message
  )

  $effectiveWebhookUrl = Resolve-WebhookUrl -ConfiguredUrl $WebhookUrl
  if ([string]::IsNullOrWhiteSpace($effectiveWebhookUrl)) {
    return
  }

  $effectiveProvider = Resolve-WebhookProvider -ConfiguredProvider $WebhookProvider -EffectiveWebhookUrl $effectiveWebhookUrl
  $payload = if ($effectiveProvider -eq "discord") {
    @{ content = $Message }
  } else {
    @{ text = $Message }
  }

  try {
    $jsonBody = $payload | ConvertTo-Json -Compress -Depth 4
    Invoke-RestMethod -Method Post -Uri $effectiveWebhookUrl -ContentType "application/json" -Body $jsonBody -TimeoutSec $WebhookTimeoutSeconds | Out-Null
  } catch {
    Write-Warning "[watchdog] Falha ao enviar alerta webhook: $($_.Exception.Message)"
  }
}

function Write-WatchdogAlert {
  param(
    [string]$Backend,
    [string]$Reason,
    [string]$Action
  )

  if ($DisableRestartAlert) {
    return
  }

  $now = Get-Date
  $alertKey = "$Backend|$Reason"
  if ($AlertCooldownSeconds -gt 0 -and $script:LastAlertAtByKey.ContainsKey($alertKey)) {
    $elapsed = ($now - $script:LastAlertAtByKey[$alertKey]).TotalSeconds
    if ($elapsed -lt $AlertCooldownSeconds) {
      return
    }
  }
  $script:LastAlertAtByKey[$alertKey] = $now

  $stamp = $now.ToString("yyyy-MM-dd HH:mm:ss")
  $message = "[$stamp] $Backend degradado; watchdog acionou $Action. Motivo=$Reason"
  $effectiveAlertLogPath = Resolve-AlertLogPath -ConfiguredPath $AlertLogPath

  try {
    $dir = Split-Path -Path $effectiveAlertLogPath -Parent
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
      New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    Add-Content -Path $effectiveAlertLogPath -Value $message
  } catch {
    Write-Warning "[watchdog] Falha ao gravar alerta em log: $($_.Exception.Message)"
  }

  try {
    if ($AlertPopupTimeoutSeconds -gt 0) {
      $shell = New-Object -ComObject WScript.Shell
      [void]$shell.Popup($message, $AlertPopupTimeoutSeconds, "KnexIT Watchdog", 48)
    }
  } catch {
    Write-Warning "[watchdog] Falha ao exibir popup de alerta: $($_.Exception.Message)"
  }

  Send-RestartWebhook -Message $message
}

function Should-RecoverBackend {
  param(
    [string]$Backend,
    [int]$CooldownSeconds
  )

  if (-not $script:LastRecoveryAtByBackend.ContainsKey($Backend)) {
    $script:LastRecoveryAtByBackend[$Backend] = [DateTime]::MinValue
  }
  if ($CooldownSeconds -le 0) {
    return $true
  }
  $now = Get-Date
  $elapsed = ($now - $script:LastRecoveryAtByBackend[$Backend]).TotalSeconds
  return $elapsed -ge $CooldownSeconds
}

function Mark-Recovery {
  param(
    [string]$Backend
  )
  $script:LastRecoveryAtByBackend[$Backend] = Get-Date
}

function Invoke-NativeCommand {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

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
    $output = & $FilePath @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    return @{
      Output = $output
      ExitCode = $exitCode
    }
  } finally {
    $script:ErrorActionPreference = $previousErrorActionPreference
    if ($hasNativePreference) {
      $script:PSNativeCommandUseErrorActionPreference = $previousNativePreference
    }
  }
}

function Resolve-KubectlPath {
  if (-not [string]::IsNullOrWhiteSpace($script:KubectlPath)) {
    return $script:KubectlPath
  }

  $cmd = Get-Command kubectl -ErrorAction SilentlyContinue
  if ($cmd) {
    $script:KubectlPath = if ($cmd.Source) { $cmd.Source } else { $cmd.Path }
    return $script:KubectlPath
  }

  try {
    $pattern = Join-Path $env:LOCALAPPDATA "Microsoft\\WinGet\\Packages\\Kubernetes.kubectl*"
    $candidate = Get-ChildItem -Path $pattern -Filter "kubectl.exe" -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
    if (-not [string]::IsNullOrWhiteSpace($candidate)) {
      $script:KubectlPath = $candidate
      return $script:KubectlPath
    }
  } catch {
    # noop
  }

  return ""
}

function Convert-NativeOutputToText {
  param(
    [object[]]$Output
  )

  return [string]::Join([Environment]::NewLine, @($Output | ForEach-Object { "$_" }))
}

function Convert-ToIntOrDefault {
  param(
    [object]$Value,
    [int]$DefaultValue
  )

  if ($null -eq $Value) {
    return $DefaultValue
  }

  try {
    return [int]$Value
  } catch {
    return $DefaultValue
  }
}

function Get-KubernetesDeploymentStatus {
  $kubectlPath = Resolve-KubectlPath
  if ([string]::IsNullOrWhiteSpace($kubectlPath)) {
    return @{
      Kind = "kubectl_missing"
      Detail = "kubectl_not_found"
      ReadyReplicas = 0
      DesiredReplicas = 0
      AvailableReplicas = 0
      WaitingReasons = @()
      ImagePullDetected = $false
    }
  }

  $deployResult = Invoke-NativeCommand -FilePath $kubectlPath -Arguments @(
    "-n", $KubernetesNamespace, "get", "deployment", $KubernetesDeploymentName, "-o", "json"
  )
  if ($deployResult.ExitCode -ne 0) {
    $outputText = Convert-NativeOutputToText -Output $deployResult.Output
    $kind = "error"
    if ($outputText -match "not found|NotFound") {
      $kind = "missing"
    } elseif ($outputText -match "Unable to connect to the server|The connection to the server|connection refused|context deadline exceeded|i/o timeout") {
      $kind = "unreachable"
    }
    return @{
      Kind = $kind
      Detail = $outputText
      ReadyReplicas = 0
      DesiredReplicas = 0
      AvailableReplicas = 0
      WaitingReasons = @()
      ImagePullDetected = $false
    }
  }

  $deployText = Convert-NativeOutputToText -Output $deployResult.Output
  $deployment = $null
  try {
    $deployment = $deployText | ConvertFrom-Json -ErrorAction Stop
  } catch {
    return @{
      Kind = "error"
      Detail = "deployment_json_parse_error"
      ReadyReplicas = 0
      DesiredReplicas = 0
      AvailableReplicas = 0
      WaitingReasons = @()
      ImagePullDetected = $false
    }
  }

  $desired = Convert-ToIntOrDefault -Value $deployment.spec.replicas -DefaultValue 1
  $ready = Convert-ToIntOrDefault -Value $deployment.status.readyReplicas -DefaultValue 0
  $available = Convert-ToIntOrDefault -Value $deployment.status.availableReplicas -DefaultValue 0

  $waitingReasons = @()
  $podsResult = Invoke-NativeCommand -FilePath $kubectlPath -Arguments @(
    "-n", $KubernetesNamespace, "get", "pods", "-l", $KubernetesPodLabelSelector, "-o", "json"
  )
  if ($podsResult.ExitCode -eq 0) {
    try {
      $podsText = Convert-NativeOutputToText -Output $podsResult.Output
      $pods = $podsText | ConvertFrom-Json -ErrorAction Stop
      foreach ($pod in @($pods.items)) {
        foreach ($containerStatus in @($pod.status.containerStatuses)) {
          $reason = "$($containerStatus.state.waiting.reason)"
          if (-not [string]::IsNullOrWhiteSpace($reason)) {
            $waitingReasons += $reason
          }
        }
      }
    } catch {
      # noop
    }
  }
  $waitingReasons = @($waitingReasons | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)
  $imagePullDetected = $waitingReasons -contains "ImagePullBackOff" -or $waitingReasons -contains "ErrImagePull"

  if ($ready -ge 1 -and $available -ge 1) {
    return @{
      Kind = "ok"
      Detail = "ready"
      ReadyReplicas = $ready
      DesiredReplicas = $desired
      AvailableReplicas = $available
      WaitingReasons = $waitingReasons
      ImagePullDetected = $imagePullDetected
    }
  }

  return @{
    Kind = "unhealthy"
    Detail = "ready=$ready desired=$desired available=$available"
    ReadyReplicas = $ready
    DesiredReplicas = $desired
    AvailableReplicas = $available
    WaitingReasons = $waitingReasons
    ImagePullDetected = $imagePullDetected
  }
}

function Test-DockerImageExists {
  param(
    [string]$ImageTag
  )

  $inspect = Invoke-NativeCommand -FilePath "docker" -Arguments @("image", "inspect", $ImageTag)
  return $inspect.ExitCode -eq 0
}

function Invoke-KubernetesAutoBuildImages {
  $scriptPath = Join-ScriptPath "kubernetes-build-local-images.ps1"
  if (-not (Test-Path $scriptPath)) {
    Write-Warning "[k8s] script de build nao encontrado: $scriptPath"
    return $false
  }

  $buildResult = Invoke-NativeCommand -FilePath "powershell.exe" -Arguments @(
    "-ExecutionPolicy", "Bypass", "-File", $scriptPath, "-WebImage", $KubernetesWebImage
  )
  if ($buildResult.ExitCode -ne 0) {
    $detail = Convert-NativeOutputToText -Output $buildResult.Output
    Write-Warning "[k8s] falha no build local da imagem web: $detail"
    return $false
  }
  return $true
}

function Invoke-KubernetesAutoLoadImages {
  $scriptPath = Join-ScriptPath "kubernetes-load-kind-images.ps1"
  if (-not (Test-Path $scriptPath)) {
    Write-Warning "[k8s] script de load de imagens nao encontrado: $scriptPath"
    return $false
  }

  $loadResult = Invoke-NativeCommand -FilePath "powershell.exe" -Arguments @(
    "-ExecutionPolicy", "Bypass", "-File", $scriptPath,
    "-ClusterName", $KubernetesClusterName,
    "-WebImage", $KubernetesWebImage
  )
  if ($loadResult.ExitCode -ne 0) {
    $detail = Convert-NativeOutputToText -Output $loadResult.Output
    Write-Warning "[k8s] falha ao carregar imagem no kind: $detail"
    return $false
  }
  return $true
}

function Resolve-EmbeddingsHealthUrl {
  if (-not [string]::IsNullOrWhiteSpace($EmbeddingsHealthUrl)) {
    return $EmbeddingsHealthUrl
  }

  $baseUrl = Get-FirstNonEmpty @(
    $env:EMBEDDING_BASE_URL,
    (Get-DotEnvValue -Name "EMBEDDING_BASE_URL"),
    "http://127.0.0.1:8001/v1"
  )
  $healthPath = Get-FirstNonEmpty @(
    $env:EMBEDDING_HEALTHCHECK_PATH,
    (Get-DotEnvValue -Name "EMBEDDING_HEALTHCHECK_PATH"),
    "/health"
  )
  if (-not $healthPath.StartsWith("/")) {
    $healthPath = "/$healthPath"
  }

  try {
    $uri = [System.Uri]$baseUrl
    $builder = New-Object System.UriBuilder($uri)
    $builder.Path = $healthPath
    $builder.Query = ""
    return $builder.Uri.AbsoluteUri.TrimEnd("/")
  } catch {
    return "http://127.0.0.1:8001/health"
  }
}

function Ensure-Docker {
  $healthy = Test-DockerEngineHealthy
  if ($healthy.Ok) {
    $vectorProbe = Resolve-VectorDbProbeTarget
    if ($vectorProbe.Enabled) {
      $vectorOk = Test-TcpEndpoint -TargetHost $vectorProbe.Host -Port $vectorProbe.Port -TimeoutMs $VectorDbProbeTimeoutMs
      if (-not $vectorOk) {
        Write-Host "[docker] Engine ok, mas endpoint vetorial indisponivel em $($vectorProbe.Host):$($vectorProbe.Port)."
      }
    }
    return $true
  }

  if (-not (Should-RecoverBackend -Backend "docker" -CooldownSeconds $DockerRestartCooldownSeconds)) {
    Write-Host "[docker] Degradado ($($healthy.Reason)); cooldown de restart ativo."
    return $false
  }

  $reason = "$($healthy.Reason)"
  if (-not [string]::IsNullOrWhiteSpace($healthy.Detail)) {
    $reason = "$reason|$($healthy.Detail)"
  }
  Write-WatchdogAlert -Backend "Docker" -Reason $reason -Action "restart"

  $freeGb = Get-SystemDriveFreeGb
  if ($freeGb -ge 0 -and $freeGb -lt 20) {
    Write-Warning "[docker] Espaco baixo no drive C: ${freeGb}GB livres. Isso aumenta risco de instabilidade."
  }

  try {
    Start-Service -Name "com.docker.service" -ErrorAction SilentlyContinue | Out-Null
  } catch {
    # Permissao de servico pode nao existir neste contexto; seguimos com restart via app.
  }

  Stop-DockerRuntimeProcesses
  Invoke-WslCleanupForDocker
  Start-Sleep -Seconds 3

  $dockerDesktopExe = Resolve-DockerDesktopExecutable
  if ([string]::IsNullOrWhiteSpace($dockerDesktopExe)) {
    Mark-Recovery -Backend "docker"
    Write-Warning "[docker] Docker Desktop.exe nao encontrado para auto-recuperacao."
    return $false
  }

  try {
    Start-Process -FilePath $dockerDesktopExe | Out-Null
  } catch {
    Mark-Recovery -Backend "docker"
    Write-Warning "[docker] Falha ao iniciar Docker Desktop: $($_.Exception.Message)"
    return $false
  }

  Mark-Recovery -Backend "docker"
  $deadline = (Get-Date).AddSeconds([Math]::Max(10, $DockerStartupGraceSeconds))
  do {
    Start-Sleep -Seconds 3
    $postRecovery = Test-DockerEngineHealthy
    if ($postRecovery.Ok) {
      Write-Host "[docker] Recuperacao concluida com sucesso."
      return $true
    }
  } while ((Get-Date) -lt $deadline)

  $detail = if (-not [string]::IsNullOrWhiteSpace($postRecovery.Detail)) { " detalhe=$($postRecovery.Detail)" } else { "" }
  Write-Warning "[docker] Recuperacao acionada, mas engine segue degradado ($($postRecovery.Reason)).$detail"
  return $false
}

function Ensure-Vllm {
  $healthy = Test-Health "http://127.0.0.1:8000/v1/models"
  if ($healthy) { return $true }

  $running = Find-ProcessByPattern "serve-vllm-wsl\.ps1|serve-vllm-restart\.ps1|serve-vllm\.sh|vllm serve"
  if ($running.Count -eq 0) {
    if (Should-RecoverBackend -Backend "vllm" -CooldownSeconds $VllmRestartCooldownSeconds) {
      Write-WatchdogAlert -Backend "vLLM" -Reason "process_not_found" -Action "restart"
      Start-DetachedPowerShellScript -ScriptPath (Join-ScriptPath "serve-vllm-restart.ps1")
      Mark-Recovery -Backend "vllm"
      Write-Host "[vLLM] Offline -> restart acionado."
    } else {
      Write-Host "[vLLM] Offline, mas cooldown de restart ativo."
    }
  } else {
    Write-Host "[vLLM] Offline e processo de bootstrap em execucao; aguardando."
  }
  return $false
}

function Ensure-Embeddings {
  $healthUrl = Resolve-EmbeddingsHealthUrl
  $healthy = Test-Health $healthUrl
  if ($healthy) { return $true }

  $running = Find-ProcessByPattern "serve-embeddings-cpu-wsl\.ps1|serve-embeddings-cpu-restart\.ps1|embedding_cpu_server\.py"
  if ($running.Count -eq 0) {
    if (Should-RecoverBackend -Backend "embeddings" -CooldownSeconds $EmbeddingsRestartCooldownSeconds) {
      Write-WatchdogAlert -Backend "RAG-Embeddings" -Reason "process_not_found" -Action "restart"
      Start-DetachedPowerShellScript -ScriptPath (Join-ScriptPath "serve-embeddings-cpu-restart.ps1")
      Mark-Recovery -Backend "embeddings"
      Write-Host "[RAG] Embeddings offline -> restart acionado."
    } else {
      Write-Host "[RAG] Embeddings offline, mas cooldown de restart ativo."
    }
  } else {
    Write-Host "[RAG] Embeddings offline e processo de bootstrap em execucao; aguardando."
  }
  return $false
}

function Ensure-KubernetesKnexai {
  $status = Get-KubernetesDeploymentStatus
  switch ($status.Kind) {
    "ok" {
      return $true
    }
    "kubectl_missing" {
      Write-OnceNotice -Key "k8s-kubectl-missing" -Message "[k8s] kubectl nao encontrado. Monitoramento de ANM/RAG no Kubernetes ignorado."
      return $true
    }
    "missing" {
      Write-OnceNotice -Key "k8s-deployment-missing" -Message "[k8s] deployment/$KubernetesDeploymentName nao encontrado no namespace $KubernetesNamespace. Monitoramento ignorado."
      return $true
    }
    "unreachable" {
      Write-OnceNotice -Key "k8s-cluster-unreachable" -Message "[k8s] cluster/context indisponivel no momento; auto-heal do deployment aguardando reconexao."
      return $false
    }
    "error" {
      Write-OnceNotice -Key "k8s-status-error" -Message "[k8s] falha ao consultar deployment/$KubernetesDeploymentName. Detalhe: $($status.Detail)"
      return $false
    }
  }

  if ($status.ImagePullDetected -and -not $DisableKubernetesAutoLoadImages) {
    if ($KubernetesAutoBuildWebImageWhenMissing -and -not (Test-DockerImageExists -ImageTag $KubernetesWebImage)) {
      [void](Invoke-KubernetesAutoBuildImages)
    }
    [void](Invoke-KubernetesAutoLoadImages)
  }

  if (Should-RecoverBackend -Backend "k8s" -CooldownSeconds $KubernetesRestartCooldownSeconds) {
    $kubectlPath = Resolve-KubectlPath
    if (-not [string]::IsNullOrWhiteSpace($kubectlPath)) {
      $restartResult = Invoke-NativeCommand -FilePath $kubectlPath -Arguments @(
        "-n", $KubernetesNamespace, "rollout", "restart", "deploy/$KubernetesDeploymentName"
      )
      if ($restartResult.ExitCode -eq 0) {
        $timeout = [Math]::Max(30, $KubernetesRolloutTimeoutSeconds)
        [void](Invoke-NativeCommand -FilePath $kubectlPath -Arguments @(
          "-n", $KubernetesNamespace, "rollout", "status", "deploy/$KubernetesDeploymentName", "--timeout=${timeout}s"
        ))
        Mark-Recovery -Backend "k8s"
        $waiting = if ($status.WaitingReasons.Count -gt 0) { $status.WaitingReasons -join "," } else { "none" }
        Write-WatchdogAlert -Backend "ANM-RAG@Kubernetes" -Reason "deployment_unhealthy_ready_${status.ReadyReplicas}_of_${status.DesiredReplicas}_waiting_${waiting}" -Action "rollout-restart"
        Write-Host "[k8s] deployment/$KubernetesDeploymentName degradado -> rollout restart acionado."
      } else {
        $detail = Convert-NativeOutputToText -Output $restartResult.Output
        Write-Warning "[k8s] falha ao reiniciar deployment/${KubernetesDeploymentName}: $detail"
      }
    }
  } else {
    Write-Host "[k8s] deployment/$KubernetesDeploymentName degradado, mas cooldown de restart ativo."
  }

  return $false
}

function To-StatusText {
  param(
    [Nullable[bool]]$Value
  )
  if ($null -eq $Value) { return "n/a" }
  return "$Value"
}

if ($IntervalSeconds -lt 5) {
  $IntervalSeconds = 5
}

if (-not $AllowMultipleInstances -and -not $Once) {
  $siblings = Get-WatchdogSiblingProcesses -CurrentPid $PID
  if ($siblings.Count -gt 0) {
    Write-Output "[watchdog] Outra instancia ja ativa (PID(s): $($siblings.ProcessId -join ',')). Encerrando esta execucao."
    exit 0
  }
}

Write-Output "[watchdog] Monitorando Docker, vLLM, RAG-embeddings e ANM/RAG no Kubernetes. Intervalo=${IntervalSeconds}s."

do {
  [Nullable[bool]]$dockerOk = $null
  [Nullable[bool]]$vllmOk = $null
  [Nullable[bool]]$embeddingsOk = $null
  [Nullable[bool]]$k8sOk = $null

  if (-not $DisableDockerWatch) {
    $dockerOk = Ensure-Docker
  }
  if (-not $DisableVllmWatch) {
    $vllmOk = Ensure-Vllm
  }
  if (-not $DisableEmbeddingsWatch) {
    $embeddingsOk = Ensure-Embeddings
  }
  if (-not $DisableKubernetesWatch) {
    $k8sOk = Ensure-KubernetesKnexai
  }

  $stamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  Write-Output "[watchdog] $stamp docker=$(To-StatusText $dockerOk) vLLM=$(To-StatusText $vllmOk) embeddings=$(To-StatusText $embeddingsOk) k8s=$(To-StatusText $k8sOk)"
  if ($Once) { break }
  Start-Sleep -Seconds $IntervalSeconds
} while ($true)
