# Reproducibility Guide V2

## 1. Estrutura local relevante
```text
anm_backend/
  adapters/
  anm/
  api/
  memory/
  orchestrator/
  services/
  docs/
  tests/
  main.py
```

## 2. Dependencias minimas
- Python 3.11+
- `fastapi`
- `uvicorn[standard]`
- `pydantic` (via FastAPI)

Instalacao:
```bash
cd anm_backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## 3. Execucao local API
```bash
cd anm_backend
uvicorn anm_backend.main:app --reload
```

### 3.1 Variaveis de ambiente do motor
```bash
set ANM_ENGINE_BASE_URL=http://127.0.0.1:8000/v1
set ANM_ENGINE_MODEL=mistral-awq
set ANM_ENGINE_API_KEY=
set ANM_ENGINE_TIMEOUT_S=45
set ANM_CHAT_MAX_TOKENS=128
set ANM_ENGINE_USE_SYSTEM_ROLE=0
```

## 4. Testes locais
Suite basica (unittest padrao):
```bash
python -m unittest discover -s anm_backend/tests -p "test_*.py"
```

## 5. Checkpoint
Salvar:
```bash
curl -X POST http://127.0.0.1:8000/memory/checkpoint -H "Content-Type: application/json" -d "{\"checkpoint_id\":\"manual-v2\"}"
```

Restaurar:
```bash
curl -X POST http://127.0.0.1:8000/memory/restore -H "Content-Type: application/json" -d "{\"checkpoint_id\":\"manual-v2\"}"
```

Arquivos em:
- `./anm_backend/data/checkpoints/*.json`

## 6. Verificacao de readiness e estado regulatorio
Endpoint debug:
```bash
curl http://127.0.0.1:8000/debug/state
```

Campos obrigatorios:
- `readiness_score`
- `readiness_state`
- `stress_load`
- `context_stability`
- `gate`

## 7. Restore de boot
Defina:
```bash
set ANM_BOOTSTRAP_CHECKPOINT=manual-v2
```
Depois suba a API para restaurar automaticamente.

## 8. Validar acoplamento real do motor
Health administrativo real:
```bash
curl http://127.0.0.1:8000/admin/health
```
Esperado:
- `api_ok=true`
- `engine_ok=true` (com motor acessivel)
- `engine_latency_ms >= 0`
- `engine_model` preenchido

Se motor indisponivel:
- `engine_ok=false`
- `erro` explicito

## 9. Validar primeiro `/chat` real ponta a ponta
```bash
curl -X POST http://127.0.0.1:8000/chat -H "Content-Type: application/json" -d "{\"message\":\"resuma em 1 frase o que e RAM-first cognition\"}"
```
Validacao minima:
1. Endpoint retorna `answer` com texto real do motor.
2. `trace_id` presente.
3. Resposta e reinjetada na memoria (`/memory/state` mostra novo item working/contexto).
