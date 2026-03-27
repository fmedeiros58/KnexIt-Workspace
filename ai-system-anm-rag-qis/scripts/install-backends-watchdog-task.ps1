param(
  [string]$TaskName = "KnexIT-Backends-Watchdog",
  [int]$IntervalSeconds = 20,
  [switch]$StartNow
)

$ErrorActionPreference = "Stop"
$hasNativePreference = Test-Path variable:PSNativeCommandUseErrorActionPreference
if ($hasNativePreference) {
  $previousNativePreference = $PSNativeCommandUseErrorActionPreference
}

$deprecatedTaskNames = @("KnexIT-vLLM-Watchdog", "KnexIT-ANM-Watchdog")

function Invoke-Schtasks {
  param(
    [string[]]$Arguments
  )

  try {
    $previousErrorActionPreference = $ErrorActionPreference
    $script:ErrorActionPreference = "Continue"
    if ($hasNativePreference) {
      $script:PSNativeCommandUseErrorActionPreference = $false
    }
    $output = & schtasks.exe @Arguments 2>&1
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

function Remove-TaskIfExists {
  param(
    [string]$Name
  )

  if ([string]::IsNullOrWhiteSpace($Name)) {
    return
  }

  try {
    Stop-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction Stop
    Write-Host "[cleanup] tarefa antiga removida: $Name"
    return
  } catch {
    $query = Invoke-Schtasks -Arguments @("/Query", "/TN", $Name, "/FO", "LIST", "/V")
    if ($query.ExitCode -ne 0) {
      return
    }
    [void](Invoke-Schtasks -Arguments @("/End", "/TN", $Name))
    [void](Invoke-Schtasks -Arguments @("/Delete", "/F", "/TN", $Name))
    Write-Host "[cleanup] tarefa antiga removida via schtasks.exe: $Name"
  }
}

if ($IntervalSeconds -lt 5) {
  $IntervalSeconds = 5
}

$scriptPath = Join-Path $PSScriptRoot "watch-knexai-backends.ps1"
if (-not (Test-Path $scriptPath)) {
  throw "Script watchdog nao encontrado: $scriptPath"
}

foreach ($deprecatedTaskName in $deprecatedTaskNames) {
  if ($deprecatedTaskName -ne $TaskName) {
    Remove-TaskIfExists -Name $deprecatedTaskName
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

$arguments = @(
  "-NoProfile",
  "-WindowStyle", "Hidden",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$scriptPath`"",
  "-IntervalSeconds", "$IntervalSeconds",
  "-DisableKubernetesWatch"
) -join " "

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments -WorkingDirectory $repoRoot.Path
$triggerAtLogon = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited

$registeredWith = "Register-ScheduledTask"
try {
  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $triggerAtLogon `
    -Settings $settings `
    -Principal $principal `
    -Force `
    -ErrorAction Stop | Out-Null
} catch {
  $registeredWith = "schtasks.exe fallback"
  Write-Warning "Register-ScheduledTask falhou ($($_.Exception.Message)). Tentando fallback via schtasks.exe."
  $taskCommand = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`" -IntervalSeconds $IntervalSeconds -DisableKubernetesWatch"
  $created = Invoke-Schtasks -Arguments @("/Create", "/F", "/SC", "ONLOGON", "/TN", $TaskName, "/TR", $taskCommand)
  if ($created.ExitCode -ne 0) {
    throw "Falha ao registrar tarefa via schtasks.exe (exit=$($created.ExitCode))."
  }
}

Write-Host "[ok] tarefa registrada: $TaskName"
Write-Host "     usuario: $currentUser"
Write-Host "     intervalo watchdog: ${IntervalSeconds}s"
Write-Host "     script: $scriptPath"
Write-Host "     cobertura: Docker + vLLM + RAG-embeddings + ChatAPI"
Write-Host "     metodo: $registeredWith"

if ($StartNow) {
  try {
    Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  } catch {
    [void](Invoke-Schtasks -Arguments @("/Run", "/TN", $TaskName))
  }
  Write-Host "[ok] tarefa iniciada agora."
}
