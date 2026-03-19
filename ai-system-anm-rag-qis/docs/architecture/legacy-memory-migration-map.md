# Legacy Memory Migration Map

## Objective
Run the new descending ANM pipeline as the primary response path and keep `anm_backend` as legacy fallback only.

## Route Policy
- Primary path: `runPipelineRootBridge` in `app/api/knexai/route.ts`.
- Legacy path: direct/ANM backend logic only when descending pipeline fails and `KNEXAI_DESCENDING_ALLOW_DIRECT_FALLBACK=1`.

## Watchdog Policy
- `scripts/watch-knexai-backends.ps1` now monitors only `vLLM` by default.
- To also auto-start legacy ANM backend, set:
  - `KNEXAI_WATCHDOG_LEGACY_ANM_ENABLED=1`

## Memory Taxonomy Migration
Old `anm_backend/memory` domains are mapped to `ai-system-anm-rag-qis` in:
- `src/06-memory-and-plasticity-layer/memory-core/legacy-memory-signals.ts`
- `src/06-memory-and-plasticity-layer/memory-core/legacy-memory-projection.ts`
- `src/06-memory-and-plasticity-layer/memory-core/legacy-memory-runtime-registry.ts`

Mapped domains:
- Global/domainal: `procedural`, `perceptual`, `metacognitive`, `prospective`, `social`, `value`, `attention`, `regulatory`
- Nodular: `nodular-attention`, `nodular-value`, `nodular-priming`, `nodular-state`, `nodular-weight`

These are persisted into `ProcessingState.memorySnapshot`:
- `globalNamespaces`
- `moduleNamespaces`
- `nodularState`
- `regulatoryState`

## Connected Layers
- Memory synthesis and scoring: `memory-layer-bridge.ts`
- Knowledge retrieval context: `knowledge-layer-bridge.ts`
- Generation context/prompt: `generation-memory-bridge.ts`, `memory-injection-builder.ts`
- Orchestration gating: `orchestration-layer-bridge.ts`
- Quantum weighting and collapse confidence: `quantum-layer-bridge.ts`
- Reflective caveats and tensions from memory runtime: `reflective-layer-bridge.ts`, `critical-reflection-engine.ts`
- Inferential expansion with prospective/procedural memory: `inferential-layer-bridge.ts`, `inferential-core/inference-engine.ts`
- Validation risk modulation from regulatory/nodular/runtime memory: `validation-layer-bridge.ts`
- Feedback reinforcement into legacy runtime memory state: `feedback-to-memory-bridge.ts`

## Gradual Cleanup Recommendation
1. Legacy Python memory backend was removed from repository after migration to ANM runtime memory modules.
2. Keep legacy fallback disabled by default (only enable when strictly needed):
   - `KNEXAI_DESCENDING_ALLOW_DIRECT_FALLBACK=1`
3. Remove remaining legacy runtime scripts after sustained stability.
