param(
  [string]$BaseUrl = "",
  [string]$AnmBaseUrl = "",
  [string]$ApiKey = "",
  [int]$TimeoutSec = 8,
  [switch]$SkipAnmCheck
)

$ErrorActionPreference = "Stop"

function Pick-FirstNonEmpty {
  param([string[]]$Values)
  foreach ($value in $Values) {
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return $value.Trim()
    }
  }
  return ""
}

function Normalize-BaseUrl {
  param([string]$Value)
  return ($Value.TrimEnd("/"))
}

function Invoke-JsonPost {
  param(
    [string]$Url,
    [hashtable]$Headers,
    [string]$Body
  )

  return Invoke-WebRequest -UseBasicParsing -Method POST -Uri $Url -Headers $Headers -ContentType "application/json" -Body $Body -TimeoutSec $TimeoutSec
}

function Invoke-RequestStatus {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers = @{},
    [string]$Body = "",
    [string]$ContentType = "application/json"
  )

  try {
    if ($Method -eq "POST") {
      $response = Invoke-WebRequest -UseBasicParsing -Method POST -Uri $Url -Headers $Headers -ContentType $ContentType -Body $Body -TimeoutSec $TimeoutSec
      return [int]$response.StatusCode
    }
    $response = Invoke-WebRequest -UseBasicParsing -Method $Method -Uri $Url -Headers $Headers -TimeoutSec $TimeoutSec
    return [int]$response.StatusCode
  } catch {
    if ($_.Exception.Response) {
      return [int]$_.Exception.Response.StatusCode
    }
    throw
  }
}

$resolvedBaseUrl = Pick-FirstNonEmpty @(
  $BaseUrl,
  $env:PUBLIC_API_BASE_URL,
  "https://api.knexspace.com"
)

if ([string]::IsNullOrWhiteSpace($resolvedBaseUrl)) {
  throw "PUBLIC_API_BASE_URL nao definido."
}

$resolvedBaseUrl = Normalize-BaseUrl $resolvedBaseUrl
$resolvedAnmBaseUrl = Pick-FirstNonEmpty @(
  $AnmBaseUrl,
  $env:AI_SYSTEM_ANM_API_BASE_URL
)
$resolvedAnmBaseUrl = if ([string]::IsNullOrWhiteSpace($resolvedAnmBaseUrl)) { "" } else { Normalize-BaseUrl $resolvedAnmBaseUrl }
$resolvedApiKey = Pick-FirstNonEmpty @(
  $ApiKey,
  $env:PUBLIC_API_KEY
)

Write-Host "== Public API Smoke ==" -ForegroundColor Cyan
Write-Host "Base URL: $resolvedBaseUrl"

$health = Invoke-WebRequest -UseBasicParsing -Method GET -Uri "$resolvedBaseUrl/health" -TimeoutSec $TimeoutSec
Write-Host "/health -> $($health.StatusCode)"
if ($health.StatusCode -ne 200) {
  throw "/health falhou com status $($health.StatusCode)"
}

$readyStatus = Invoke-RequestStatus -Method "GET" -Url "$resolvedBaseUrl/ready"
Write-Host "/ready -> $readyStatus"
if ($readyStatus -ne 200 -and $readyStatus -ne 503) {
  throw "/ready retornou status inesperado: $readyStatus (esperado: 200 ou 503)"
}

if (-not $SkipAnmCheck -and -not [string]::IsNullOrWhiteSpace($resolvedAnmBaseUrl)) {
  $anmHealth = Invoke-WebRequest -UseBasicParsing -Method GET -Uri "$resolvedAnmBaseUrl/healthz" -TimeoutSec $TimeoutSec
  Write-Host "ANM /healthz -> $($anmHealth.StatusCode) [$resolvedAnmBaseUrl]"
  if ($anmHealth.StatusCode -ne 200) {
    throw "ANM /healthz falhou com status $($anmHealth.StatusCode)"
  }
} else {
  Write-Host "ANM legacy check -> skipped"
}

if ([string]::IsNullOrWhiteSpace($resolvedApiKey)) {
  Write-Warning "PUBLIC_API_KEY nao informada. Pulando teste autenticado de /chat."
  exit 0
}

$headers = @{
  "x-api-key" = $resolvedApiKey
}
$chatBody = '{"message":"teste de publicacao via vercel"}'
$chat = Invoke-JsonPost -Url "$resolvedBaseUrl/chat" -Headers $headers -Body $chatBody
Write-Host "/chat (auth) -> $($chat.StatusCode)"

if ($chat.StatusCode -ne 200) {
  throw "/chat autenticado falhou com status $($chat.StatusCode)"
}

Write-Host "Smoke de API publica concluido com sucesso." -ForegroundColor Green

