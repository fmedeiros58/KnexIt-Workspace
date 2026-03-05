"""
FILE: memory/ram_cortex.py
RESPONSIBILITY: Primary in-RAM cognitive state for ANM (RAM-first cognition center).
FLOW ROLE: Central volatile cortex consumed by memory, orchestrator and adapters.
READS: Observations, resonance signals, hypothesis events and regulatory summaries.
RAM WRITES: Active context, activations, hypotheses, processing trails and cycle metadata.
PERSISTS: Serializable snapshots only via checkpoint layer.
PRIMARY RISK: State corruption under concurrent mutation without lock boundaries.
"""

from __future__ import annotations

from collections import deque
from dataclasses import asdict, dataclass, field
from threading import RLock
from typing import Any, Deque, Dict, List

from anm_backend.audit import audit_log
from anm_backend.contracts import ActivationRecord, HypothesisState, Signal, utc_now_iso


@dataclass
class RamCortex:
    """
    Objective:
        Hold live cognitive state in RAM as ANM's main cognition substrate.
    Responsibilities:
        Keep active context, activation map, hypothesis map and short processing traces.
    Limits:
        No persistence ownership and no engine calls.
    Mutates:
        Core RAM state through explicit methods only.
    Must not:
        Expose unsafe direct mutation of internal structures.
    """

    active_context: Dict[str, Any] = field(default_factory=dict)
    activation_map: Dict[str, float] = field(default_factory=dict)
    quick_index: Dict[str, int] = field(default_factory=dict)
    active_hypotheses: Dict[str, HypothesisState] = field(default_factory=dict)
    signal_bus: Deque[Signal] = field(default_factory=lambda: deque(maxlen=256))
    processing_trail: Deque[Dict[str, Any]] = field(default_factory=lambda: deque(maxlen=256))
    activation_records: Deque[ActivationRecord] = field(default_factory=lambda: deque(maxlen=256))
    cycle_metadata: Dict[str, Any] = field(default_factory=lambda: {"cycle_id": 0, "last_updated": utc_now_iso()})
    regulatory_summary: Dict[str, float] = field(default_factory=dict)
    _lock: RLock = field(default_factory=RLock, repr=False)

    @property
    def hot_index(self) -> Dict[str, int]:
        """
        Purpose:
            Backward-compatible alias for quick index usage.
        Parameters:
            None.
        Returns:
            Dict[str, int]: Quick access index.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        return self.quick_index

    def read_state(self) -> Dict[str, Any]:
        """
        Purpose:
            Return lightweight read-only view of critical cortex surfaces.
        Parameters:
            None.
        Returns:
            Dict[str, Any]: Readable state summary.
        Side Effects:
            None.
        RAM Impact:
            Temporary dictionary allocation.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        with self._lock:
            return {
                "context_items": len(self.active_context),
                "activations": dict(self.activation_map),
                "hypotheses": len(self.active_hypotheses),
                "cycle_metadata": dict(self.cycle_metadata),
                "regulatory_summary": dict(self.regulatory_summary),
            }

    def update_context(self, key: str, value: Any, *, source: str) -> None:
        """
        Purpose:
            Insert/update active context entry and bump quick index.
        Parameters:
            key: Context key.
            value: Context value.
            source: Producing subsystem.
        Returns:
            None.
        Side Effects:
            Emits structured audit log.
        RAM Impact:
            Mutates active context and quick index.
        Persistence Impact:
            Captured in snapshots.
        Expected Failures:
            None.
        """

        with self._lock:
            self.active_context[key] = value
            self.quick_index[key] = self.quick_index.get(key, 0) + 1
            self.cycle_metadata["last_updated"] = utc_now_iso()
        audit_log(
            component="memory.ram_cortex",
            event="context_updated",
            payload={"key": key, "source": source, "hotness": self.quick_index.get(key, 0)},
        )

    def upsert_context(self, key: str, value: Any, *, source: str) -> None:
        """
        Purpose:
            Backward-compatible alias to update context.
        Parameters:
            key: Context key.
            value: Context value.
            source: Producing subsystem.
        Returns:
            None.
        Side Effects:
            Delegates to update_context.
        RAM Impact:
            Delegated mutation.
        Persistence Impact:
            Delegated.
        Expected Failures:
            None.
        """

        self.update_context(key, value, source=source)

    def set_activation(self, nodule_id: str, level: float, *, cycle_id: int = 0, reason: str = "resonance") -> None:
        """
        Purpose:
            Update nodule activation map and append activation record.
        Parameters:
            nodule_id: Nodule identifier.
            level: Activation level.
            cycle_id: Current cycle id.
            reason: Activation reason.
        Returns:
            None.
        Side Effects:
            Emits activation audit logs.
        RAM Impact:
            Mutates activation map and activation record trail.
        Persistence Impact:
            Included in snapshot.
        Expected Failures:
            None.
        """

        clamped_level = max(0.0, min(1.5, float(level)))
        with self._lock:
            self.activation_map[nodule_id] = clamped_level
            self.activation_records.append(
                ActivationRecord(
                    nodule_id=nodule_id,
                    level=clamped_level,
                    cycle_id=cycle_id,
                    reason=reason,
                )
            )
            self.cycle_metadata["cycle_id"] = max(int(self.cycle_metadata.get("cycle_id", 0)), cycle_id)
            self.cycle_metadata["last_updated"] = utc_now_iso()
        audit_log(
            component="memory.ram_cortex",
            event="activation_received",
            payload={"nodule_id": nodule_id, "new_value": clamped_level, "cycle_id": cycle_id, "reason": reason},
        )

    def update_salience(self, key: str, delta: int = 1) -> int:
        """
        Purpose:
            Update quick-index salience counter.
        Parameters:
            key: Indexed key.
            delta: Increment/decrement value.
        Returns:
            int: New salience value.
        Side Effects:
            None.
        RAM Impact:
            Mutates quick index.
        Persistence Impact:
            Included in snapshots.
        Expected Failures:
            None.
        """

        with self._lock:
            new_value = max(0, self.quick_index.get(key, 0) + delta)
            if new_value == 0 and key in self.quick_index:
                del self.quick_index[key]
            else:
                self.quick_index[key] = new_value
            return new_value

    def push_signal(self, signal: Signal | Dict[str, Any]) -> None:
        """
        Purpose:
            Append signal to in-process signal bus.
        Parameters:
            signal: Signal instance or compatible dictionary.
        Returns:
            None.
        Side Effects:
            Emits audit log.
        RAM Impact:
            Mutates signal bus queue.
        Persistence Impact:
            Included in checkpoint snapshots.
        Expected Failures:
            KeyError for malformed dictionary input.
        """

        if isinstance(signal, dict):
            signal = Signal(
                trace_id=str(signal.get("trace_id", "trace-unknown")),
                source_id=str(signal.get("source_id", "unknown")),
                target_id=str(signal.get("target_id", signal.get("nodule_id", "unknown"))),
                strength=float(signal.get("strength", 0.0)),
                depth=int(signal.get("depth", 0)),
                cycle_id=int(signal.get("cycle_id", 0)),
                metadata=dict(signal.get("metadata", {})),
            )
        with self._lock:
            self.signal_bus.append(signal)
        audit_log(
            component="memory.ram_cortex",
            event="signal_queued",
            payload={
                "trace_id": signal.trace_id,
                "source_id": signal.source_id,
                "target_id": signal.target_id,
                "strength": signal.strength,
                "cycle_id": signal.cycle_id,
            },
        )

    def add_processing_trace(self, *, trace_id: str, cycle_id: int, nodule_id: str, detail: Dict[str, Any]) -> None:
        """
        Purpose:
            Track short processing trail entries for auditability.
        Parameters:
            trace_id: Correlation id for request flow.
            cycle_id: Resonance cycle id.
            nodule_id: Nodule id.
            detail: Additional detail payload.
        Returns:
            None.
        Side Effects:
            None.
        RAM Impact:
            Appends processing trail entry.
        Persistence Impact:
            Trail entries are checkpointed.
        Expected Failures:
            None.
        """

        with self._lock:
            self.processing_trail.append(
                {"timestamp": utc_now_iso(), "trace_id": trace_id, "cycle_id": cycle_id, "nodule_id": nodule_id, "detail": detail}
            )

    def register_hypothesis(self, item: HypothesisState) -> None:
        """
        Purpose:
            Insert or update one active hypothesis.
        Parameters:
            item: Hypothesis state.
        Returns:
            None.
        Side Effects:
            Emits creation/update audit logs.
        RAM Impact:
            Mutates active hypothesis map.
        Persistence Impact:
            Included in snapshots.
        Expected Failures:
            None.
        """

        with self._lock:
            previous = self.active_hypotheses.get(item.hypothesis_id)
            self.active_hypotheses[item.hypothesis_id] = item
        event_name = "hypothesis_updated" if previous else "hypothesis_created"
        audit_log(
            component="memory.ram_cortex",
            event=event_name,
            payload={
                "hypothesis_id": item.hypothesis_id,
                "previous_value": previous.score if previous else None,
                "new_value": item.score,
            },
        )

    def remove_hypothesis(self, hypothesis_id: str, *, reason: str = "pruned") -> None:
        """
        Purpose:
            Remove hypothesis from active set.
        Parameters:
            hypothesis_id: Target hypothesis id.
            reason: Removal reason.
        Returns:
            None.
        Side Effects:
            Emits audit log when removed.
        RAM Impact:
            Mutates active hypothesis map.
        Persistence Impact:
            Included in snapshots.
        Expected Failures:
            None.
        """

        with self._lock:
            removed = self.active_hypotheses.pop(hypothesis_id, None)
        if removed is None:
            return
        audit_log(
            component="memory.ram_cortex",
            event="hypothesis_removed",
            payload={"hypothesis_id": hypothesis_id, "reason": reason, "previous_value": removed.score},
        )

    def clean_noise(self, *, min_activation: float = 0.05, max_context_items: int = 256) -> Dict[str, int]:
        """
        Purpose:
            Prune low-activation and overgrown context residue.
        Parameters:
            min_activation: Minimum activation kept in map.
            max_context_items: Maximum number of context entries preserved.
        Returns:
            Dict[str, int]: Counts of cleaned entries.
        Side Effects:
            Emits audit log when cleanup occurs.
        RAM Impact:
            Mutates activation/context maps.
        Persistence Impact:
            Reflected in subsequent checkpoints.
        Expected Failures:
            None.
        """

        with self._lock:
            low_nodes = [node_id for node_id, value in self.activation_map.items() if value < min_activation]
            for node_id in low_nodes:
                del self.activation_map[node_id]

            removed_context = 0
            if len(self.active_context) > max_context_items:
                sorted_keys = sorted(self.quick_index.items(), key=lambda pair: pair[1])
                to_remove = len(self.active_context) - max_context_items
                for key, _ in sorted_keys[:to_remove]:
                    if key in self.active_context:
                        del self.active_context[key]
                        removed_context += 1
                    if key in self.quick_index:
                        del self.quick_index[key]

        cleaned = {"activations_removed": len(low_nodes), "context_removed": removed_context}
        if cleaned["activations_removed"] or cleaned["context_removed"]:
            audit_log(component="memory.ram_cortex", event="noise_cleaned", payload=cleaned)
        return cleaned

    def update_cycle_metadata(self, *, cycle_id: int, trace_id: str | None = None) -> None:
        """
        Purpose:
            Update cycle metadata for current cognitive processing stage.
        Parameters:
            cycle_id: Current cycle id.
            trace_id: Optional trace id.
        Returns:
            None.
        Side Effects:
            None.
        RAM Impact:
            Mutates cycle metadata.
        Persistence Impact:
            Included in snapshots.
        Expected Failures:
            None.
        """

        with self._lock:
            self.cycle_metadata["cycle_id"] = cycle_id
            self.cycle_metadata["trace_id"] = trace_id
            self.cycle_metadata["last_updated"] = utc_now_iso()

    def get_cycle_metadata_value(self, key: str, default: Any = None) -> Any:
        """
        Purpose:
            Safely read one metadata field from cycle metadata map.
        Parameters:
            key: Metadata key.
            default: Fallback value when key is absent.
        Returns:
            Any: Stored value or fallback.
        Side Effects:
            None.
        RAM Impact:
            None.
        Persistence Impact:
            None.
        Expected Failures:
            None.
        """

        with self._lock:
            return self.cycle_metadata.get(key, default)

    def set_cycle_metadata_value(self, key: str, value: Any) -> None:
        """
        Purpose:
            Safely upsert one metadata field used by chat-turn coordination.
        Parameters:
            key: Metadata key.
            value: Metadata value.
        Returns:
            None.
        Side Effects:
            Updates cycle timestamp.
        RAM Impact:
            Mutates cycle metadata map.
        Persistence Impact:
            Included in snapshots.
        Expected Failures:
            None.
        """

        with self._lock:
            self.cycle_metadata[str(key)] = value
            self.cycle_metadata["last_updated"] = utc_now_iso()

    def set_regulatory_summary(self, summary: Dict[str, float]) -> None:
        """
        Purpose:
            Reflect regulatory variables that affect cognitive flow.
        Parameters:
            summary: Regulatory summary.
        Returns:
            None.
        Side Effects:
            None.
        RAM Impact:
            Mutates regulatory summary map.
        Persistence Impact:
            Included in snapshots.
        Expected Failures:
            None.
        """

        with self._lock:
            self.regulatory_summary = {key: float(value) for key, value in summary.items()}

    def snapshot(self) -> Dict[str, Any]:
        """
        Purpose:
            Export serializable snapshot of live cortex.
        Parameters:
            None.
        Returns:
            Dict[str, Any]: Snapshot payload.
        Side Effects:
            Emits audit log.
        RAM Impact:
            Temporary allocation of serialized structures.
        Persistence Impact:
            Intended for checkpoint save.
        Expected Failures:
            None.
        """

        with self._lock:
            payload = {
                "active_context": dict(self.active_context),
                "activation_map": dict(self.activation_map),
                "quick_index": dict(self.quick_index),
                "signal_bus": [asdict(item) for item in self.signal_bus],
                "active_hypotheses": {key: asdict(value) for key, value in self.active_hypotheses.items()},
                "processing_trail": list(self.processing_trail),
                "activation_records": [asdict(item) for item in self.activation_records],
                "cycle_metadata": dict(self.cycle_metadata),
                "regulatory_summary": dict(self.regulatory_summary),
            }
        audit_log(
            component="memory.ram_cortex",
            event="snapshot_created",
            payload={"context_items": len(payload["active_context"]), "hypotheses": len(payload["active_hypotheses"])},
        )
        return payload

    def restore(self, snapshot: Dict[str, Any]) -> None:
        """
        Purpose:
            Restore cortex state from serialized snapshot.
        Parameters:
            snapshot: Snapshot payload.
        Returns:
            None.
        Side Effects:
            Emits audit log after restore.
        RAM Impact:
            Replaces core cortex structures.
        Persistence Impact:
            None directly.
        Expected Failures:
            TypeError for malformed payload.
        """

        signal_items = []
        for item in snapshot.get("signal_bus", []):
            if not isinstance(item, dict):
                continue
            signal_items.append(
                Signal(
                    trace_id=str(item.get("trace_id", "trace-unknown")),
                    source_id=str(item.get("source_id", "unknown")),
                    target_id=str(item.get("target_id", "unknown")),
                    strength=float(item.get("strength", 0.0)),
                    depth=int(item.get("depth", 0)),
                    cycle_id=int(item.get("cycle_id", 0)),
                    timestamp=str(item.get("timestamp", utc_now_iso())),
                    metadata=dict(item.get("metadata", {})),
                )
            )
        activation_items = []
        for item in snapshot.get("activation_records", []):
            if not isinstance(item, dict):
                continue
            activation_items.append(
                ActivationRecord(
                    nodule_id=str(item.get("nodule_id", "unknown")),
                    level=float(item.get("level", 0.0)),
                    cycle_id=int(item.get("cycle_id", 0)),
                    reason=str(item.get("reason", "restore")),
                    timestamp=str(item.get("timestamp", utc_now_iso())),
                )
            )

        hypotheses = {}
        for key, value in dict(snapshot.get("active_hypotheses", {})).items():
            if not isinstance(value, dict):
                continue
            hypotheses[key] = HypothesisState(
                hypothesis_id=str(value.get("hypothesis_id", key)),
                summary=str(value.get("summary", "")),
                score=float(value.get("score", 0.0)),
                probability=float(value.get("probability", 0.0)),
                cost=float(value.get("cost", 1.0)),
                objective_fit=float(value.get("objective_fit", 0.0)),
                stimulus_coherence=float(value.get("stimulus_coherence", 0.5)),
                metadata=dict(value.get("metadata", {})),
            )

        with self._lock:
            self.active_context = dict(snapshot.get("active_context", {}))
            self.activation_map = {str(key): float(value) for key, value in dict(snapshot.get("activation_map", {})).items()}
            self.quick_index = {str(key): int(value) for key, value in dict(snapshot.get("quick_index", snapshot.get("hot_index", {}))).items()}
            self.signal_bus = deque(signal_items, maxlen=256)
            self.active_hypotheses = hypotheses
            self.processing_trail = deque(list(snapshot.get("processing_trail", [])), maxlen=256)
            self.activation_records = deque(activation_items, maxlen=256)
            self.cycle_metadata = dict(snapshot.get("cycle_metadata", {"cycle_id": 0, "last_updated": utc_now_iso()}))
            self.regulatory_summary = {
                str(key): float(value) for key, value in dict(snapshot.get("regulatory_summary", {})).items()
            }
        audit_log(
            component="memory.ram_cortex",
            event="snapshot_restored",
            payload={"context_items": len(self.active_context), "hypotheses": len(self.active_hypotheses)},
        )
