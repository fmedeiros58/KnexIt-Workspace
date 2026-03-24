# Kubernetes Runtime Vinculation (AI-System ANM <-> vLLM <-> Web)

Este runbook ativa a vinculacao estavel entre:
- `knexit-web` (Next.js + pipeline)
- `ai-system-anm-rag-qis` (pipeline ANM descendente no runtime web)
- `vllm` (OpenAI-compatible)

A vinculacao principal pode operar em dois modos:
- `in-cluster`: Web (`ai-system-anm-rag-qis`) -> vLLM no proprio Kubernetes (`http://vllm:8000/v1`)
- `hybrid`: Web (`ai-system-anm-rag-qis`) no Kubernetes -> vLLM no host (`http://host.docker.internal:8000/v1`)

## 1) Instalar ferramentas

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-kubernetes-tools.ps1
powershell -ExecutionPolicy Bypass -File scripts/kubernetes-doctor.ps1
```

Para `kind`, o Docker daemon precisa estar ativo.

## 2) Build de imagens locais (sem cloud)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/kubernetes-build-local-images.ps1
```

Por padrao, isso constroi `knexit-web`.

Se quiser construir em etapas:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/kubernetes-build-local-images.ps1 -SkipWeb
```

## 3) Subir cluster e aplicar manifests

### Base

```powershell
powershell -ExecutionPolicy Bypass -File scripts/kubernetes-bootstrap-kind.ps1 -Profile base
```

### Self-hosted (NodePort + vLLM com GPU)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/kubernetes-bootstrap-kind.ps1 -Profile selfhost
```

### Hybrid (ANM/Web no K8s + vLLM no host)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/kubernetes-bootstrap-kind.ps1 -Profile hybrid
```

Neste perfil, o deployment `vllm` nao e aplicado no cluster.
O endpoint de embeddings do RAG permanece no host (`http://host.docker.internal:8001/v1`).

## 4) Carregar imagens locais no kind

```powershell
powershell -ExecutionPolicy Bypass -File scripts/kubernetes-load-kind-images.ps1
```

Observacao:
- `scripts/kubernetes-bootstrap-kind.ps1` ja tenta carregar automaticamente a imagem local `knexit-web:local` no `kind` antes do rollout.
- Se a imagem nao existir no Docker local, use:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/kubernetes-bootstrap-kind.ps1 -Profile hybrid -AutoBuildWebImageWhenMissing
```

## 5) Verificar rollout

```powershell
kubectl --context kind-knexit-local -n knexit get pods -o wide
kubectl --context kind-knexit-local -n knexit get svc
kubectl --context kind-knexit-local -n knexit logs deploy/knexit-web --tail=120
```

## Observacoes importantes

- Em ambiente `kind` sem GPU, prefira `-Profile hybrid` para manter vLLM fora do cluster.
- Se usar `-Profile base`/`-Profile selfhost` sem GPU no cluster, o `vllm` pode ficar `Pending` por `Insufficient nvidia.com/gpu`.
- Em servidor com GPU real, mantenha `deploy/kubernetes-selfhost` e instale NVIDIA device plugin no cluster.
- Se o host estiver com horario atrasado e ocorrer erro TLS (`not yet valid`), ajuste o relogio do sistema ou use contexto local com `insecure-skip-tls-verify` apenas para dev.
- Se o Docker travar durante build grande, reinicie o Docker Desktop e rode os builds em etapas (`-SkipWeb`).
