param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

function Get-ListeningPids([int]$LocalPort) {
  $connections = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue
  if (-not $connections) { return @() }
  return $connections | Select-Object -ExpandProperty OwningProcess -Unique
}

$pids = Get-ListeningPids -LocalPort $Port
if ($pids.Count -gt 0) {
  Write-Output "[INFO] Encerrando processo(s) na porta ${Port}: $($pids -join ', ')"
  foreach ($procId in $pids) {
    try {
      Stop-Process -Id $procId -Force -ErrorAction Stop
      Write-Output "[OK] PID encerrado: ${procId}"
    } catch {
      Write-Output "[WARN] Falha ao encerrar PID ${procId}: $($_.Exception.Message)"
    }
  }
  Start-Sleep -Milliseconds 600
} else {
  Write-Output "[INFO] Porta ${Port} ja estava livre."
}

Write-Output "[INFO] Subindo Next dev em localhost:${Port}"
& npm run dev
