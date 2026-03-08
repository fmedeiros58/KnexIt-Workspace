# Identity Runtime Layer Audit (2026-03-10)

## Scope
- Re-audit after implementing multi-face overlay/tracking, environment-gated auto-capture, and backend layer modules.
- Reviewed backend runtime modules, API schemas/routes, Next proxy fallback, and `knexai/identity-runtime/page.tsx`.

## Layer Status (Current)

| Layer | Status | Evidence | Notes |
|---|---|---|---|
| 1. Capture and acquisition | Partial | `knexai/identity-runtime/page.tsx` (`getUserMedia`, `captureFrameFromVideo`, environment slots 2/3/4) | Live browser capture works; environments 2/3/4 are derived slices from one stream (not physical multi-camera yet). |
| 2. Face detection | Implemented | `anm_backend/services/identity_runtime/face_detector.py`; frontend local fallback in `page.tsx` | Backend official detector + browser fallback now both support multiple faces. |
| 3. Landmarks and pose | Implemented | `anm_backend/services/identity_runtime/pose_estimator.py` | Yaw/pitch/roll + pose label + expected-view match are active in backend analyze flow. |
| 4. Frame quality gate | Implemented | `anm_backend/services/identity_runtime/frame_quality_gate.py` | Blur/light/framing/stability gate active before capture decisions. |
| 5. Alignment and normalization | Implemented | `face_aligner.py`, `face_normalizer.py`, integrated in analyzer | Alignment/normalization are executed and reported in per-face analysis payload. |
| 6. Multi-view enrollment | Partial | `multi_view_enrollment.py`, new enrollment routes | Enrollment exists in-memory by view; missing persistent SQL profile consolidation. |
| 7. Embedding generation | Partial | `app/api/identity/face-embeddings/route.ts`, `scripts/embedding_cpu_server.py` | Embedding service exists, but analyzer core does not yet embed natively on backend pipeline step 7. |
| 8. Vector matching | Partial | `vector_matcher.py`, `target_search_engine.py`, recognition event flow | Core matcher exists; full pose-specialized matching policy and persistent vector index integration are still limited. |
| 9. Temporal tracking | Implemented | `temporal_tracker.py`, analyzer `track_id/track_hits`, `/recognition/track/{track_id}` | Multi-face track continuity is active in backend analyzer responses. |
| 10. Passive liveness | Implemented | `passive_liveness_checker.py`, analyzer output `passive_liveness` | Passive signal is active (motion/pose temporal cues), with pending/live/suspicious states. |
| 11. Active liveness | Partial | `active_liveness_checker.py`, `/recognition/liveness/active/start` | Challenge sessions exist, but full challenge loop validation UI/backend handshake is still basic. |
| 12. Multilayer consensus | Partial | `face_consensus_engine.py`, analyzer output `consensus` | Consensus engine is active, but embedding secondary path and richer weight tuning remain pending. |

## What Was Implemented In This Pass
- Backend:
  - Added runtime modules for temporal tracking, align/normalize, passive/active liveness, consensus, enrollment, matcher, target search.
  - Refactored `IdentityFrameAnalyzer` to support `max_faces`, per-face outputs (`faces[]`), `track_id`, `track_hits`, liveness, consensus.
  - Expanded API schemas/routes with recognition lifecycle endpoints (`enroll`, `search`, `liveness`, `status`, `track`, `profile`).
- Frontend runtime panel:
  - Overlay now renders multiple bounding boxes simultaneously with per-face/track labels.
  - Stream analysis now consumes backend `faces[]` and requests `max_faces`.
  - Auto-capture for environments 2/3/4 now validates each environment with official `frame/analyze` gate (pose+quality) before capture.
  - Fallback behavior keeps overlay and environment gate operational with local detector when backend is unavailable.
  - UI wording migrated from "canal" to "ambiente de validação" while preserving source IDs.

## Remaining High-Impact Gaps
1. Physical multi-camera ingestion is not complete; env 2/3/4 still come from one camera slicing.
2. Backend-native embedding generation (layer 7) and secondary embedder orchestration are not yet integrated into analyzer loop.
3. Persistent enrollment/profile consolidation in SQL (centroids per pose, quality-aware profile updates) is still pending.
4. Full target-search operational loop (continuous directed matching + strict temporal confirmation policy) needs deeper coupling with runtime session state.
5. Active liveness requires richer challenge progression and verification telemetry across frontend/backend.
