"""
FILE: main.py
RESPONSIBILITY: Bootstrap ANM backend runtime and FastAPI application.
FLOW ROLE: Explicitly wires RAM cortex, memory stack, readiness gate, orchestrator and adapters.
READS: Environment configuration values.
RAM WRITES: Initializes all live runtime components.
PERSISTS: Optional bootstrap checkpoint load.
PRIMARY RISK: Bootstrap order mismatch can produce inconsistent runtime state.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Dict

from fastapi import FastAPI

from anm_backend.adapters.engine_client import EngineClient
from anm_backend.adapters.llm_adapter import LLMAdapter
from anm_backend.adapters.prompt_builder import PromptBuilder
from anm_backend.adapters.response_parser import ResponseParser
from anm_backend.anm.network import Network
from anm_backend.anm.neuron import Neuron
from anm_backend.anm.nodule import Nodule
from anm_backend.anm.plasticity_readiness import PlasticityReadiness
from anm_backend.anm.synapse import Synapse
from anm_backend.api.routes_admin import router as admin_router
from anm_backend.api.routes_chat import router as chat_router
from anm_backend.api.routes_debug import router as debug_router
from anm_backend.api.routes_identity import router as identity_router
from anm_backend.api.routes_memory import router as memory_router
from anm_backend.api.routes_write import router as write_router
from anm_backend.memory.checkpoint_manager import CheckpointManager
from anm_backend.memory.forgetting_engine import ForgettingEngine
from anm_backend.memory.global_memory import GlobalMemory
from anm_backend.memory.memory_manager import MemoryManager
from anm_backend.memory.memory_policies import MemoryPolicies
from anm_backend.memory.module_memory import ModuleMemory
from anm_backend.memory.nodule_memory import NoduleMemory
from anm_backend.memory.persistence_bridge import PersistenceBridge
from anm_backend.memory.ram_cortex import RamCortex
from anm_backend.memory.regulatory_state import RegulatoryState
from anm_backend.memory.working_memory import WorkingMemory
from anm_backend.orchestrator.collapse_engine import CollapseEngine
from anm_backend.orchestrator.contextual_plasticity_gate import ContextualPlasticityGate
from anm_backend.orchestrator.hypothesis_pool import HypothesisPool
from anm_backend.orchestrator.myelination_engine import MyelinationEngine
from anm_backend.orchestrator.nodule_registry import NoduleRegistry
from anm_backend.orchestrator.pathway_graph import Pathway, PathwayGraph
from anm_backend.orchestrator.resonance_engine import ResonanceEngine
from anm_backend.orchestrator.router import Router
from anm_backend.orchestrator.scheduler import Scheduler
from anm_backend.services.cognitive_service import CognitiveService
from anm_backend.services.identity_runtime import (
    ActiveLivenessChecker,
    ContinuousIdentityRuntime,
    FaceAligner,
    FaceConsensusEngine,
    FaceDetector,
    FaceNormalizer,
    FrameQualityGate,
    IdentityFrameAnalyzer,
    IdentityRuntimeBootstrap,
    IdentitySqlRuntimeService,
    MultiViewEnrollment,
    MultiCameraStreamManager,
    PassiveLivenessChecker,
    PoseEstimator,
    SelfModelEngine,
    SourceDiscoveryManager,
    TargetSearchEngine,
    TemporalTracker,
    UserPatternRecognizer,
    VectorMatcher,
)
from anm_backend.services.response_orchestration import ResponseOrchestrator
from anm_backend.services.write_continue_service import WriteContinueService
from anm_backend.services.write_service import WriteService
from anm_backend.services.write_summary_service import WriteSummaryService
from anm_backend.write.repository import InMemoryWriteWorkspaceRepository


def _assert_optional_nvme_base_path() -> None:
    raw_value = str(os.getenv("NVME_BASE_PATH", "")).strip()
    if not raw_value:
        return
    nvme_path = Path(raw_value)
    if not nvme_path.exists():
        raise RuntimeError(
            f"NVME_BASE_PATH configurado, mas inexistente: '{raw_value}'. "
            "Verifique montagem/ordem de boot do volume antes de iniciar o ANM backend."
        )
    if not nvme_path.is_dir():
        raise RuntimeError(f"NVME_BASE_PATH invalido (nao e diretorio): '{raw_value}'.")


def _assert_read_write_directory(path: Path, *, env_name: str) -> None:
    try:
        path.mkdir(parents=True, exist_ok=True)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"{env_name} invalido: nao foi possivel criar '{path}'.") from exc

    if not path.is_dir():
        raise RuntimeError(f"{env_name} invalido: '{path}' nao e diretorio.")

    probe = path / ".anm-rw-probe"
    try:
        probe.write_text("ok", encoding="utf-8")
        _ = probe.read_text(encoding="utf-8")
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"{env_name} sem permissao de leitura/escrita em '{path}'.") from exc
    finally:
        try:
            probe.unlink(missing_ok=True)
        except Exception:
            pass


def _build_default_nodule(nodule_id: str) -> Nodule:
    neurons: Dict[str, Neuron] = {
        f"{nodule_id}-input": Neuron(neuron_id=f"{nodule_id}-input", threshold=0.55),
        f"{nodule_id}-mid": Neuron(neuron_id=f"{nodule_id}-mid", threshold=0.65),
        f"{nodule_id}-out": Neuron(neuron_id=f"{nodule_id}-out", threshold=0.60),
    }
    synapses = [
        Synapse(source_id=f"{nodule_id}-input", target_id=f"{nodule_id}-mid", weight=0.62, priority=0.7, cost=0.9),
        Synapse(source_id=f"{nodule_id}-mid", target_id=f"{nodule_id}-out", weight=0.58, priority=0.68, cost=0.95),
    ]
    return Nodule(nodule_id=nodule_id, neurons=neurons, synapses=synapses)


def create_app() -> FastAPI:
    _assert_optional_nvme_base_path()

    cortex = RamCortex()
    regulatory_state = RegulatoryState()
    policies = MemoryPolicies(
        promote_threshold=float(os.getenv("ANM_PROMOTE_THRESHOLD", "0.72")),
        forget_threshold=float(os.getenv("ANM_FORGET_THRESHOLD", "0.25")),
        decay_factor=float(os.getenv("ANM_DECAY_FACTOR", "0.96")),
    )
    working_memory = WorkingMemory(capacity=int(os.getenv("ANM_WORKING_MEMORY_CAPACITY", "192")))
    global_memory = GlobalMemory()
    module_memory = ModuleMemory()
    nodule_memory = NoduleMemory()
    forgetting_engine = ForgettingEngine(policies=policies)
    memory_manager = MemoryManager(
        cortex=cortex,
        working_memory=working_memory,
        global_memory=global_memory,
        module_memory=module_memory,
        nodule_memory=nodule_memory,
        policies=policies,
        forgetting_engine=forgetting_engine,
        regulatory_state=regulatory_state,
    )

    checkpoint_dir = Path(os.getenv("ANM_CHECKPOINT_DIR", "anm_backend/data/checkpoints"))
    _assert_read_write_directory(checkpoint_dir, env_name="ANM_CHECKPOINT_DIR")
    checkpoint_manager = CheckpointManager(base_dir=checkpoint_dir)
    persistence_bridge = PersistenceBridge(memory_manager=memory_manager, checkpoint_manager=checkpoint_manager)

    network = Network()
    registry = NoduleRegistry()
    graph = PathwayGraph()
    myelination_engine = MyelinationEngine()
    router = Router(max_fan_out=int(os.getenv("ANM_MAX_FAN_OUT", "3")))
    scheduler = Scheduler(max_cycles=int(os.getenv("ANM_MAX_CYCLES", "6")))
    hypothesis_pool = HypothesisPool(max_size=int(os.getenv("ANM_MAX_HYPOTHESES", "32")))
    collapse_engine = CollapseEngine(mode=os.getenv("ANM_COLLAPSE_MODE", "fuse_top2"))
    resonance_engine = ResonanceEngine(
        registry=registry,
        graph=graph,
        router=router,
        scheduler=scheduler,
        max_depth=int(os.getenv("ANM_MAX_DEPTH", "4")),
        convergence_epsilon=float(os.getenv("ANM_CONVERGENCE_EPSILON", "0.02")),
    )
    plasticity_readiness = PlasticityReadiness(history_size=int(os.getenv("ANM_READINESS_HISTORY", "24")))
    contextual_gate = ContextualPlasticityGate(
        base_learning_rate=float(os.getenv("ANM_BASE_LEARNING_RATE", "0.04")),
        base_pruning_rate=float(os.getenv("ANM_BASE_PRUNING_RATE", "0.06")),
        base_consolidation_rate=float(os.getenv("ANM_BASE_CONSOLIDATION_RATE", "0.10")),
        base_resonance_depth=int(os.getenv("ANM_MAX_DEPTH", "4")),
    )

    language_nodule = _build_default_nodule("language_nodule")
    planner_nodule = _build_default_nodule("planner_nodule")
    critic_nodule = _build_default_nodule("critic_nodule")
    for nodule_id, nodule, capabilities in [
        ("language_nodule", language_nodule, {"chat": 0.95, "text": 0.92}),
        ("planner_nodule", planner_nodule, {"planning": 0.9, "synthesis": 0.82}),
        ("critic_nodule", critic_nodule, {"verification": 0.86, "consistency": 0.88}),
    ]:
        network.register_nodule(nodule)
        registry.register(nodule, capabilities=capabilities)

    graph.upsert_pathway(Pathway(source_id="language_nodule", target_id="planner_nodule", weight=0.68, priority=0.8, cost=0.9, myelin=0.62))
    graph.upsert_pathway(Pathway(source_id="planner_nodule", target_id="critic_nodule", weight=0.63, priority=0.74, cost=1.0, myelin=0.57))
    graph.upsert_pathway(Pathway(source_id="critic_nodule", target_id="language_nodule", weight=0.58, priority=0.7, cost=1.05, myelin=0.54))
    graph.upsert_pathway(Pathway(source_id="language_nodule", target_id="critic_nodule", weight=0.55, priority=0.66, cost=1.1, myelin=0.5))

    engine_client = EngineClient.from_env()
    llm_adapter = LLMAdapter(engine_client=engine_client, prompt_builder=PromptBuilder(), response_parser=ResponseParser())
    response_orchestrator = ResponseOrchestrator(llm_adapter=llm_adapter)
    source_discovery_manager = SourceDiscoveryManager()
    multi_camera_stream_manager = MultiCameraStreamManager(source_manager=source_discovery_manager)
    identity_sql_runtime_service = IdentitySqlRuntimeService()
    identity_runtime = ContinuousIdentityRuntime(
        source_manager=source_discovery_manager,
        stream_manager=multi_camera_stream_manager,
        sql_runtime_service=identity_sql_runtime_service,
    )
    identity_runtime_bootstrap = IdentityRuntimeBootstrap(runtime=identity_runtime)
    self_model_engine = SelfModelEngine(runtime=identity_runtime)
    user_pattern_recognizer = UserPatternRecognizer()
    face_detector = FaceDetector()
    pose_estimator = PoseEstimator()
    frame_quality_gate = FrameQualityGate()
    temporal_tracker = TemporalTracker()
    face_aligner = FaceAligner()
    face_normalizer = FaceNormalizer()
    passive_liveness_checker = PassiveLivenessChecker()
    active_liveness_checker = ActiveLivenessChecker()
    face_consensus_engine = FaceConsensusEngine()
    vector_matcher = VectorMatcher()
    multi_view_enrollment = MultiViewEnrollment()
    target_search_engine = TargetSearchEngine(matcher=vector_matcher)
    identity_frame_analyzer = IdentityFrameAnalyzer(
        face_detector=face_detector,
        pose_estimator=pose_estimator,
        quality_gate=frame_quality_gate,
        temporal_tracker=temporal_tracker,
        face_aligner=face_aligner,
        face_normalizer=face_normalizer,
        passive_liveness_checker=passive_liveness_checker,
        face_consensus_engine=face_consensus_engine,
    )
    identity_runtime_bootstrap.bootstrap(reason="application_boot")
    write_repository = InMemoryWriteWorkspaceRepository()
    write_summary_service = WriteSummaryService(repository=write_repository)
    write_service = WriteService(
        repository=write_repository,
        llm_adapter=llm_adapter,
        memory_manager=memory_manager,
        summary_service=write_summary_service,
    )
    write_continue_service = WriteContinueService(
        repository=write_repository,
        llm_adapter=llm_adapter,
        response_orchestrator=response_orchestrator,
    )
    cognitive_service = CognitiveService(
        memory_manager=memory_manager,
        resonance_engine=resonance_engine,
        hypothesis_pool=hypothesis_pool,
        collapse_engine=collapse_engine,
        llm_adapter=llm_adapter,
        plasticity_readiness=plasticity_readiness,
        regulatory_state=regulatory_state,
        contextual_gate=contextual_gate,
        graph=graph,
        myelination_engine=myelination_engine,
        response_orchestrator=response_orchestrator,
        identity_runtime=identity_runtime,
        self_model_engine=self_model_engine,
        user_pattern_recognizer=user_pattern_recognizer,
    )

    app = FastAPI(title="ANM Backend", version="0.2.0")
    app.include_router(chat_router)
    app.include_router(write_router)
    app.include_router(memory_router)
    app.include_router(identity_router)
    app.include_router(debug_router)
    app.include_router(admin_router)

    app.state.cortex = cortex
    app.state.regulatory_state = regulatory_state
    app.state.memory_manager = memory_manager
    app.state.persistence_bridge = persistence_bridge
    app.state.checkpoint_manager = checkpoint_manager
    app.state.network = network
    app.state.registry = registry
    app.state.graph = graph
    app.state.myelination_engine = myelination_engine
    app.state.router = router
    app.state.scheduler = scheduler
    app.state.hypothesis_pool = hypothesis_pool
    app.state.collapse_engine = collapse_engine
    app.state.resonance_engine = resonance_engine
    app.state.engine_client = engine_client
    app.state.llm_adapter = llm_adapter
    app.state.response_orchestrator = response_orchestrator
    app.state.source_discovery_manager = source_discovery_manager
    app.state.multi_camera_stream_manager = multi_camera_stream_manager
    app.state.identity_sql_runtime_service = identity_sql_runtime_service
    app.state.identity_runtime = identity_runtime
    app.state.identity_runtime_bootstrap = identity_runtime_bootstrap
    app.state.self_model_engine = self_model_engine
    app.state.user_pattern_recognizer = user_pattern_recognizer
    app.state.face_detector = face_detector
    app.state.pose_estimator = pose_estimator
    app.state.frame_quality_gate = frame_quality_gate
    app.state.temporal_tracker = temporal_tracker
    app.state.face_aligner = face_aligner
    app.state.face_normalizer = face_normalizer
    app.state.passive_liveness_checker = passive_liveness_checker
    app.state.active_liveness_checker = active_liveness_checker
    app.state.face_consensus_engine = face_consensus_engine
    app.state.vector_matcher = vector_matcher
    app.state.multi_view_enrollment = multi_view_enrollment
    app.state.target_search_engine = target_search_engine
    app.state.identity_frame_analyzer = identity_frame_analyzer
    app.state.plasticity_readiness = plasticity_readiness
    app.state.contextual_gate = contextual_gate
    app.state.cognitive_service = cognitive_service
    app.state.write_repository = write_repository
    app.state.write_service = write_service
    app.state.write_continue_service = write_continue_service
    app.state.write_summary_service = write_summary_service

    bootstrap_checkpoint = str(os.getenv("ANM_BOOTSTRAP_CHECKPOINT", "")).strip()
    if bootstrap_checkpoint:
        persistence_bridge.bootstrap_from_checkpoint(checkpoint_id=bootstrap_checkpoint)

    @app.on_event("shutdown")
    def _shutdown_identity_runtime() -> None:
        identity_runtime.shutdown()

    @app.get("/healthz")
    def healthz() -> Dict[str, object]:
        readiness = plasticity_readiness.latest()
        engine_health = engine_client.health()
        identity_snapshot = identity_runtime.snapshot()
        return {
            "ok": bool(engine_health.get("ok", False)),
            "engine_model": engine_client.model_name,
            "engine_health": engine_health,
            "readiness_state": readiness.readiness_state.value if readiness else "UNKNOWN",
            "identity_runtime_status": identity_snapshot.status.value,
            "identity_runtime_enabled": identity_snapshot.runtime_enabled,
            "identity_sources": len(identity_snapshot.camera_sources),
            "identity_active_streams": len(identity_snapshot.active_streams),
        }

    return app


app = create_app()
