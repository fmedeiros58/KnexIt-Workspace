param(
  [string]$VenvPath = ".venv-identity",
  [string]$PythonVersion = "3.11"
)

$ErrorActionPreference = "Stop"

Write-Host "[identity-env] Checking uv..."
python -m uv --version *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "[identity-env] Installing uv..."
  python -m pip install uv
}

Write-Host "[identity-env] Installing Python $PythonVersion via uv..."
python -m uv python install $PythonVersion

Write-Host "[identity-env] Creating virtual environment at $VenvPath..."
python -m uv venv $VenvPath --python $PythonVersion

$pythonExe = Join-Path $VenvPath "Scripts\\python.exe"
if (-not (Test-Path $pythonExe)) {
  throw "Python executable not found in venv: $pythonExe"
}

Write-Host "[identity-env] Bootstrapping pip..."
& $pythonExe -m ensurepip --upgrade

Write-Host "[identity-env] Installing base packaging tooling..."
& $pythonExe -m pip install --upgrade pip "setuptools<81" wheel

$resolvedScripts = (Resolve-Path (Join-Path $VenvPath "Scripts")).Path
$env:PATH = "$resolvedScripts;$env:PATH"

Write-Host "[identity-env] Installing identity runtime dependencies..."
& $pythonExe -m pip install -r anm_backend/requirements-identity-runtime.txt --no-build-isolation

Write-Host "[identity-env] Running import smoke check..."
& $pythonExe -c "import cv2, mediapipe, insightface, deepface, face_recognition, ultralytics, torch, onnxruntime; print('identity_runtime_env_ok')"

Write-Host "[identity-env] Completed."
