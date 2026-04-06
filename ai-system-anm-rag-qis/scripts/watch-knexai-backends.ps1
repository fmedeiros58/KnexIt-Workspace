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
  [switch]$EnableAnmWatch,
  [switch]$DisableAnmWatch,
  [string]$AnmHealthUrl = "",
  [int]$AnmHealthTimeoutSeconds = 5,
  [int]$AnmRestartCooldownSeconds = 120,
  [string]$AnmComposeFile = "",
  [string]$AnmComposeServiceName = "anm",
  [string]$AnmContainerName = "",
  [switch]$DisableAnmAutoStart,
  [switch]$DisableAnmChatProbe,
  [string]$AnmChatProbeUrl = "",
  [int]$AnmChatProbeTimeoutSeconds = 8,
  [int]$AnmFailureThreshold = 2,
  [string]$ChatHealthUrl = "",
  [int]$ChatHealthTimeoutSeconds = 10,
  [int]$ChatFailureThreshold = 3,
  [int]$ChatRestartCooldownSeconds = 120,
  [int]$ChatStartupGraceSeconds = 90,
  [string]$ChatRestartScript = "dev-restart.ps1",
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
  "anm" = [DateTime]::MinValue
  "chat" = [DateTime]::MinValue
  "k8s" = [DateTime]::MinValue
}
$script:ConsecutiveFailureCountByBackend = @{
  "chat" = 0
  "anm" = 0
}
$script:OneTimeNotices = @{}
$script:KubectlPath = ""
$script:WorkspaceRootPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$script:WorkspaceScriptsPath = Join-Path $script:WorkspaceRootPath "scripts"

function Join-ScriptPath([string]$scriptName) {
  return Join-Path $script:WorkspaceScriptsPath $scriptName
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
  $repoRoot = $script:WorkspaceRootPath
  return Join-Path $repoRoot ".env.local"
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

function Convert-ToBooleanOrDefault {
  param(
    [string]$Value,
    [bool]$DefaultValue = $false
  )

  $normalized = "$Value".Trim().ToLowerInvariant()
  if ([string]::IsNullOrWhiteSpace($normalized)) {
    return $DefaultValue
  }
  if (@("1", "true", "yes", "on").Contains($normalized)) {
    return $true
  }
  if (@("0", "false", "no", "off").Contains($normalized)) {
    return $false
  }
  return $DefaultValue
}

function Resolve-RepoRootPath {
  return $script:WorkspaceRootPath
}

function Resolve-AnmWatchEnabled {
  return $false
}

function Resolve-AnmHealthUrl {
  if (-not [string]::IsNullOrWhiteSpace($AnmHealthUrl)) {
    return $AnmHealthUrl.Trim()
  }
  $anmBaseUrl = Get-FirstNonEmpty @(
    $env:AI_SYSTEM_ANM_API_BASE_URL,
    (Get-DotEnvValue -Name "AI_SYSTEM_ANM_API_BASE_URL"),
    "http://127.0.0.1:3000"
  )
  $normalizedBase = "$anmBaseUrl".Trim().TrimEnd("/")
  if ([string]::IsNullOrWhiteSpace($normalizedBase)) {
    return "http://127.0.0.1:3000/api/healthz"
  }
  return "$normalizedBase/api/healthz"
}

function Resolve-AnmComposeFilePath {
  $candidate = Get-FirstNonEmpty @(
    $AnmComposeFile,
    $env:AI_SYSTEM_ANM_DOCKER_COMPOSE_FILE,
    (Get-DotEnvValue -Name "AI_SYSTEM_ANM_DOCKER_COMPOSE_FILE")
  )
  if ([string]::IsNullOrWhiteSpace($candidate)) {
    return ""
  }

  if ([System.IO.Path]::IsPathRooted($candidate)) {
    return $candidate
  }
  $repoRoot = Resolve-RepoRootPath
  return (Join-Path $repoRoot $candidate)
}

function Resolve-AnmChatProbeEnabled {
  if ($DisableAnmChatProbe) {
    return $false
  }

  $probeFlag = Get-FirstNonEmpty @(
    $env:KNEXAI_AI_SYSTEM_ANM_CHAT_PROBE_ENABLED,
    (Get-DotEnvValue -Name "KNEXAI_AI_SYSTEM_ANM_CHAT_PROBE_ENABLED"),
    "1"
  )

  return (Convert-ToBooleanOrDefault -Value $probeFlag -DefaultValue $true)
}

function Resolve-AnmChatProbeUrl {
  if (-not [string]::IsNullOrWhiteSpace($AnmChatProbeUrl)) {
    return $AnmChatProbeUrl.Trim()
  }

  $configured = Get-FirstNonEmpty @(
    $env:KNEXAI_AI_SYSTEM_ANM_CHAT_PROBE_URL,
    (Get-DotEnvValue -Name "KNEXAI_AI_SYSTEM_ANM_CHAT_PROBE_URL")
  )
  if (-not [string]::IsNullOrWhiteSpace($configured)) {
    return $configured.Trim()
  }

  $anmBaseUrl = Get-FirstNonEmpty @(
    $env:AI_SYSTEM_ANM_API_BASE_URL,
    (Get-DotEnvValue -Name "AI_SYSTEM_ANM_API_BASE_URL"),
    "http://127.0.0.1:3000"
  )
  $normalizedBase = "$anmBaseUrl".Trim().TrimEnd("/")
  if ([string]::IsNullOrWhiteSpace($normalizedBase)) {
    return "http://127.0.0.1:3000/api/chat"
  }
  return "$normalizedBase/api/chat"
}

function Resolve-AnmChatProbeMessage {
  return Get-FirstNonEmpty @(
    $env:KNEXAI_AI_SYSTEM_ANM_CHAT_PROBE_MESSAGE,
    (Get-DotEnvValue -Name "KNEXAI_AI_SYSTEM_ANM_CHAT_PROBE_MESSAGE"),
    "__watchdog_probe__"
  )
}

function Resolve-ChatHealthUrl {
  if (-not [string]::IsNullOrWhiteSpace($ChatHealthUrl)) {
    return $ChatHealthUrl.Trim()
  }

  return Get-FirstNonEmpty @(
    $env:KNEXAI_CHAT_HEALTH_URL,
    (Get-DotEnvValue -Name "KNEXAI_CHAT_HEALTH_URL"),
    "http://127.0.0.1:3000/api/healthz"
  )
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

function Reset-ConsecutiveFailureCount {
  param(
    [string]$Backend
  )

  if (-not $script:ConsecutiveFailureCountByBackend.ContainsKey($Backend)) {
    $script:ConsecutiveFailureCountByBackend[$Backend] = 0
    return
  }
  $script:ConsecutiveFailureCountByBackend[$Backend] = 0
}

function Add-ConsecutiveFailure {
  param(
    [string]$Backend
  )

  if (-not $script:ConsecutiveFailureCountByBackend.ContainsKey($Backend)) {
    $script:ConsecutiveFailureCountByBackend[$Backend] = 0
  }
  $script:ConsecutiveFailureCountByBackend[$Backend] += 1
  return [int]$script:ConsecutiveFailureCountByBackend[$Backend]
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

function Resolve-AnmComposeServiceName {
  return Get-FirstNonEmpty @(
    $AnmComposeServiceName,
    $env:AI_SYSTEM_ANM_DOCKER_SERVICE_NAME,
    (Get-DotEnvValue -Name "AI_SYSTEM_ANM_DOCKER_SERVICE_NAME"),
    "anm"
  )
}

function Resolve-AnmContainerName {
  return Get-FirstNonEmpty @(
    $AnmContainerName,
    $env:AI_SYSTEM_ANM_DOCKER_CONTAINER_NAME,
    (Get-DotEnvValue -Name "AI_SYSTEM_ANM_DOCKER_CONTAINER_NAME")
  )
}

function Invoke-DockerComposeUpForAnm {
  param(
    [string]$ComposeFile,
    [string]$ServiceName
  )

  return Invoke-ProcessWithTimeout -FilePath "docker" -Arguments @(
    "compose", "-f", $ComposeFile, "up", "-d", "--build", $ServiceName
  ) -TimeoutSeconds 180
}

function Invoke-DockerRestartContainer {
  param(
    [string]$ContainerName
  )

  return Invoke-ProcessWithTimeout -FilePath "docker" -Arguments @(
    "restart", $ContainerName
  ) -TimeoutSeconds 45
}

function Test-DockerContainerRunning {
  param(
    [string]$ContainerName
  )

  $query = Invoke-ProcessWithTimeout -FilePath "docker" -Arguments @(
    "ps", "--filter", "name=^/${ContainerName}$", "--format", "{{.Names}}"
  ) -TimeoutSeconds 12
  if ($query.TimedOut -or $query.ExitCode -ne 0) {
    return $false
  }
  return "$($query.StdOut)".Trim() -eq $ContainerName
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

function Ensure-ChatApi {
  $healthUrl = Resolve-ChatHealthUrl
  $healthTimeout = [Math]::Max(3, $ChatHealthTimeoutSeconds)
  $healthy = Test-Health -url $healthUrl -timeoutSec $healthTimeout
  if ($healthy) {
    Reset-ConsecutiveFailureCount -Backend "chat"
    return $true
  }

  # Evita falso positivo na primeira chamada (cold start/compilacao do Next).
  Start-Sleep -Seconds 2
  $healthyRetry = Test-Health -url $healthUrl -timeoutSec $healthTimeout
  if ($healthyRetry) {
    Reset-ConsecutiveFailureCount -Backend "chat"
    return $true
  }

  $failCount = Add-ConsecutiveFailure -Backend "chat"
  $threshold = [Math]::Max(1, $ChatFailureThreshold)
  if ($failCount -lt $threshold) {
    Write-Host "[chat] Falha de health $failCount/$threshold em $healthUrl; aguardando antes de reiniciar."
    return $false
  }

  if (-not (Should-RecoverBackend -Backend "chat" -CooldownSeconds $ChatRestartCooldownSeconds)) {
    Write-Host "[chat] Endpoint offline em $healthUrl, mas cooldown de restart ativo."
    return $false
  }

  $restartScriptPath = Join-ScriptPath $ChatRestartScript
  if (-not (Test-Path $restartScriptPath)) {
    Mark-Recovery -Backend "chat"
    Write-Warning "[chat] Script de restart do Next nao encontrado: $restartScriptPath"
    return $false
  }

  Write-WatchdogAlert -Backend "ChatAPI" -Reason "health_unreachable" -Action "restart-next"
  Start-DetachedPowerShellScript -ScriptPath $restartScriptPath
  Mark-Recovery -Backend "chat"
  Write-Host "[chat] Reinicio do Next acionado via $ChatRestartScript."

  $deadline = (Get-Date).AddSeconds([Math]::Max(20, $ChatStartupGraceSeconds))
  do {
    Start-Sleep -Seconds 3
    if (Test-Health -url $healthUrl -timeoutSec $healthTimeout) {
      Reset-ConsecutiveFailureCount -Backend "chat"
      Write-Host "[chat] Endpoint recuperado com sucesso ($healthUrl)."
      return $true
    }
  } while ((Get-Date) -lt $deadline)

  Write-Warning "[chat] Reinicio acionado, mas endpoint do chat segue indisponivel: $healthUrl"
  return $false
}

function Test-AnmChatProbe {
  param(
    [string]$ProbeUrl,
    [int]$TimeoutSeconds = 8
  )

  if ([string]::IsNullOrWhiteSpace($ProbeUrl)) {
    return @{
      Ok = $false
      Reason = "probe_url_missing"
      Detail = "probe_url_missing"
    }
  }

  $probeMessage = Resolve-AnmChatProbeMessage
  $payload = @{
    message = $probeMessage
    prompt = $probeMessage
    stream = $false
    history = @()
  } | ConvertTo-Json -Compress -Depth 4

  try {
    $response = Invoke-RestMethod `
      -Method Post `
      -Uri $ProbeUrl `
      -TimeoutSec ([Math]::Max(3, $TimeoutSeconds)) `
      -ContentType "application/json; charset=utf-8" `
      -Body $payload

    $answer = ""
    if ($response -is [string]) {
      $answer = "$response".Trim()
    } else {
      $answer = Get-FirstNonEmpty @(
        "$($response.answer)",
        "$($response.text)",
        "$($response.output)"
      )
    }

    if ([string]::IsNullOrWhiteSpace($answer)) {
      return @{
        Ok = $false
        Reason = "empty_answer"
        Detail = "empty_answer"
      }
    }

    return @{
      Ok = $true
      Reason = "ok"
      Detail = "answer_chars_$($answer.Length)"
    }
  } catch {
    $statusCode = 0
    if ($_.Exception -and $_.Exception.Response -and $_.Exception.Response.StatusCode) {
      try {
        $statusCode = [int]$_.Exception.Response.StatusCode
      } catch {
        $statusCode = 0
      }
    }
    $reason = if ($statusCode -gt 0) { "http_$statusCode" } else { "request_failed" }
    return @{
      Ok = $false
      Reason = $reason
      Detail = $_.Exception.Message
    }
  }
}

function Ensure-Anm {
  $healthUrl = Resolve-AnmHealthUrl
  $healthy = Test-Health -url $healthUrl -timeoutSec ([Math]::Max(2, $AnmHealthTimeoutSeconds))
  $degradationReason = "health_unreachable"
  if ($healthy) {
    if (-not (Resolve-AnmChatProbeEnabled)) {
      return $true
    }

    $probeUrl = Resolve-AnmChatProbeUrl
    $probe = Test-AnmChatProbe -ProbeUrl $probeUrl -TimeoutSeconds $AnmChatProbeTimeoutSeconds
    if ($probe.Ok) {
      Reset-ConsecutiveFailureCount -Backend "anm"
      return $true
    }

    $degradationReason = "chat_probe_$($probe.Reason)"
    Write-Warning "[anm] Health OK em $healthUrl, mas probe de chat falhou em $probeUrl ($($probe.Reason))."
  }

  $anmFailCount = Add-ConsecutiveFailure -Backend "anm"
  $anmThreshold = [Math]::Max(1, $AnmFailureThreshold)
  if ($anmFailCount -lt $anmThreshold) {
    Write-Host "[anm] Falha $anmFailCount/$anmThreshold ($degradationReason); aguardando antes de reiniciar."
    return $false
  }

  if ($DisableAnmAutoStart) {
    Write-Warning "[anm] Endpoint/probe degradado ($degradationReason), mas auto-start esta desabilitado."
    return $false
  }

  $dockerHealth = Test-DockerEngineHealthy
  if (-not $dockerHealth.Ok) {
    Write-Host "[anm] Endpoint/probe degradado ($degradationReason) e Docker degradado ($($dockerHealth.Reason))."
    return $false
  }

  if (-not (Should-RecoverBackend -Backend "anm" -CooldownSeconds $AnmRestartCooldownSeconds)) {
    Write-Host "[anm] Endpoint/probe degradado ($degradationReason), mas cooldown de restart ativo."
    return $false
  }

  Write-WatchdogAlert -Backend "ANM" -Reason $degradationReason -Action "restart"

  $composeFile = Resolve-AnmComposeFilePath
  $serviceName = Resolve-AnmComposeServiceName
  $containerName = Resolve-AnmContainerName
  $restartSucceeded = $false

  if (Test-Path $composeFile) {
    $composeResult = Invoke-DockerComposeUpForAnm -ComposeFile $composeFile -ServiceName $serviceName
    $composeCombined = [string]::Join([Environment]::NewLine, @("$($composeResult.StdOut)", "$($composeResult.StdErr)"))
    if (-not $composeResult.TimedOut -and ($composeResult.ExitCode -eq 0 -or $composeCombined -match "Container\s+.+\s+Started")) {
      $restartSucceeded = $true
      Write-Host "[anm] docker compose up -d executado para servico '$serviceName'."
    } elseif (Test-DockerContainerRunning -ContainerName $containerName) {
      $restartSucceeded = $true
      Write-Warning "[anm] docker compose retornou status nao ideal, mas container '$containerName' ficou ativo."
    } else {
      $detail = Get-FirstNonEmpty @($composeResult.StdErr, $composeResult.StdOut, "compose_up_failed")
      Write-Warning "[anm] Falha no docker compose up para ANM: $detail"
    }
  } else {
    $restartResult = Invoke-DockerRestartContainer -ContainerName $containerName
    $restartCombined = [string]::Join([Environment]::NewLine, @("$($restartResult.StdOut)", "$($restartResult.StdErr)"))
    if (-not $restartResult.TimedOut -and ($restartResult.ExitCode -eq 0 -or $restartCombined -match [Regex]::Escape($containerName))) {
      $restartSucceeded = $true
      Write-Host "[anm] docker restart executado para container '$containerName'."
    } elseif (Test-DockerContainerRunning -ContainerName $containerName) {
      $restartSucceeded = $true
      Write-Warning "[anm] docker restart retornou status nao ideal, mas container '$containerName' ficou ativo."
    } else {
      $detail = Get-FirstNonEmpty @($restartResult.StdErr, $restartResult.StdOut, "container_restart_failed")
      Write-Warning "[anm] Falha ao reiniciar container ANM '$containerName': $detail"
    }
  }

  Mark-Recovery -Backend "anm"
  if (-not $restartSucceeded) {
    return $false
  }

  $deadline = (Get-Date).AddSeconds(45)
  do {
    Start-Sleep -Seconds 3
    if (Test-Health -url $healthUrl -timeoutSec ([Math]::Max(2, $AnmHealthTimeoutSeconds))) {
      Reset-ConsecutiveFailureCount -Backend "anm"
      Write-Host "[anm] Recuperacao concluida com sucesso ($healthUrl)."
      return $true
    }
  } while ((Get-Date) -lt $deadline)

  Write-Warning "[anm] Recuperacao acionada, mas endpoint ainda indisponivel: $healthUrl"
  return $false
}

function Ensure-KubernetesKnexai {
  $status = Get-KubernetesDeploymentStatus
  switch ($status.Kind) {
    "ok" {
      return $true
    }
    "kubectl_missing" {
      Write-OnceNotice -Key "k8s-kubectl-missing" -Message "[k8s] kubectl nao encontrado. Monitoramento de AI-SYSTEM/RAG no Kubernetes ignorado."
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
        Write-WatchdogAlert -Backend "AI-SYSTEM-RAG@Kubernetes" -Reason "deployment_unhealthy_ready_${status.ReadyReplicas}_of_${status.DesiredReplicas}_waiting_${waiting}" -Action "rollout-restart"
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

$anmWatchEnabled = Resolve-AnmWatchEnabled
$watchTargets = @()
if (-not $DisableDockerWatch) { $watchTargets += "Docker" }
if (-not $DisableVllmWatch) { $watchTargets += "vLLM" }
if (-not $DisableEmbeddingsWatch) { $watchTargets += "RAG-embeddings" }
$watchTargets += "ChatAPI"
if ($anmWatchEnabled) { $watchTargets += "ANM" }
if (-not $DisableKubernetesWatch) { $watchTargets += "AI-SYSTEM/RAG@Kubernetes" }
if ($watchTargets.Count -eq 0) { $watchTargets += "none" }
Write-Output "[watchdog] Monitorando: $($watchTargets -join ', '). Intervalo=${IntervalSeconds}s."

do {
  [Nullable[bool]]$dockerOk = $null
  [Nullable[bool]]$vllmOk = $null
  [Nullable[bool]]$embeddingsOk = $null
  [Nullable[bool]]$chatOk = $null
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
  $chatOk = Ensure-ChatApi
  if ($anmWatchEnabled) {
    [void](Ensure-Anm)
  }
  if (-not $DisableKubernetesWatch) {
    $k8sOk = Ensure-KubernetesKnexai
  }

  $stamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  Write-Output "[watchdog] $stamp docker=$(To-StatusText $dockerOk) vLLM=$(To-StatusText $vllmOk) embeddings=$(To-StatusText $embeddingsOk) chat=$(To-StatusText $chatOk) k8s=$(To-StatusText $k8sOk)"
  if ($Once) { break }
  Start-Sleep -Seconds $IntervalSeconds
} while ($true)

