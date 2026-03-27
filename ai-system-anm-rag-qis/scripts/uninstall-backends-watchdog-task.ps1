param(
  [string]$TaskName = "KnexIT-Backends-Watchdog",
  [switch]$StopRunning
)

$ErrorActionPreference = "Stop"
$hasNativePreference = Test-Path variable:PSNativeCommandUseErrorActionPreference
if ($hasNativePreference) {
  $previousNativePreference = $PSNativeCommandUseErrorActionPreference
}

$taskNames = @($TaskName, "KnexIT-vLLM-Watchdog", "KnexIT-ANM-Watchdog") | Select-Object -Unique

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
    return $false
  }

  try {
    if ($StopRunning) {
      Stop-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    }
    Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction Stop
    Write-Host "[ok] tarefa removida: $Name"
    return $true
  } catch {
    $query = Invoke-Schtasks -Arguments @("/Query", "/TN", $Name, "/FO", "LIST", "/V")
    if ($query.ExitCode -ne 0) {
      return $false
    }
    if ($StopRunning) {
      [void](Invoke-Schtasks -Arguments @("/End", "/TN", $Name))
    }
    $deleted = Invoke-Schtasks -Arguments @("/Delete", "/F", "/TN", $Name)
    if ($deleted.ExitCode -eq 0) {
      Write-Host "[ok] tarefa removida: $Name (via schtasks.exe)"
      return $true
    }
    throw "Falha ao remover tarefa via schtasks.exe (exit=$($deleted.ExitCode))."
  }
}

$removedAny = $false
foreach ($name in $taskNames) {
  if (Remove-TaskIfExists -Name $name) {
    $removedAny = $true
  }
}

if (-not $removedAny) {
  Write-Host "[ok] nenhuma tarefa watchdog encontrada para remocao."
}

