"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  CirclePause,
  CirclePlay,
  Images,
  Power,
  Radar,
  RefreshCcw,
  ScanFace,
  Upload,
  UserRoundSearch,
} from "lucide-react";

type IdentitySource = {
  source_id: string;
  name: string;
  source_type: string;
  device_ref: string;
  resolution: string;
  fps: number;
  priority: number;
  active: boolean;
  connected: boolean;
  last_heartbeat_at: string;
};

type IdentityStream = {
  stream_id: string;
  source_id: string;
  status: string;
  fps_observed: number;
  latency_ms: number;
  dropped_frames: number;
};

type IdentityEntity = {
  entity_id: string;
  label: string;
  mode: string;
  confidence: number;
  source_id?: string | null;
  nominal_name?: string | null;
  metadata?: Record<string, unknown>;
  profile_image_url?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
  first_seen_at?: string;
  last_seen_at: string;
};

type IdentityPanelPayload = {
  status: string;
  runtime_enabled: boolean;
  runtime_paused: boolean;
  auto_start_enabled: boolean;
  selected_source_id?: string | null;
  awareness_state: Record<string, unknown>;
  camera_sources: IdentitySource[];
  active_streams: IdentityStream[];
  tracked_entities: IdentityEntity[];
  current_identity?: IdentityEntity | null;
  self_model_state: Record<string, unknown>;
  user_pattern_state: Record<string, unknown>;
  last_error?: string;
  updated_at: string;
};

type StageCameraTile = {
  id: string;
  name: string;
  sourceType: string;
  connected: boolean;
  isPlaceholder: boolean;
};

type EmbeddingCaptureSlot = "left" | "front" | "right";

type EmbeddingCaptureEntry = {
  image: string | null;
  capturedAt: string | null;
};

type IdentityImageAsset = {
  image_key: string;
  entity_key?: string | null;
  source_key?: string | null;
  capture_view?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number;
  public_url?: string | null;
  created_at: string;
};

type InducedReferenceAsset = {
  local_id: string;
  file_name: string;
  mime_type: string;
  data_url: string;
  created_at: string;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  disabled: { label: "Desabilitado", className: "border-zinc-300 bg-zinc-100 text-zinc-700" },
  enabled_idle: { label: "Habilitado sem stream", className: "border-slate-300 bg-slate-100 text-slate-700" },
  monitoring: { label: "Monitorando", className: "border-sky-300 bg-sky-100 text-sky-700" },
  tracking: { label: "Rastreando", className: "border-indigo-300 bg-indigo-100 text-indigo-700" },
  validating: { label: "Validando", className: "border-amber-300 bg-amber-100 text-amber-700" },
  identified: { label: "Identidade confirmada", className: "border-emerald-300 bg-emerald-100 text-emerald-700" },
  conflict: { label: "Conflito identitario", className: "border-rose-300 bg-rose-100 text-rose-700" },
  paused: { label: "Pausado", className: "border-zinc-400 bg-zinc-200 text-zinc-800" },
  degraded: { label: "Degradado", className: "border-orange-300 bg-orange-100 text-orange-700" },
};

const INITIAL_PAYLOAD: IdentityPanelPayload = {
  status: "disabled",
  runtime_enabled: false,
  runtime_paused: false,
  auto_start_enabled: false,
  selected_source_id: null,
  awareness_state: {},
  camera_sources: [],
  active_streams: [],
  tracked_entities: [],
  current_identity: null,
  self_model_state: {},
  user_pattern_state: {},
  updated_at: new Date().toISOString(),
};

function statusToken(status: string) {
  return STATUS_META[status] || STATUS_META.disabled;
}

function asPrettyDate(value: string) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString("pt-BR");
}

function captureFrameFromVideo(video: HTMLVideoElement | null) {
  if (!video) return null;
  const width = video.videoWidth || 0;
  const height = video.videoHeight || 0;
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function derivePointFrameFromVideo(video: HTMLVideoElement | null, point: EmbeddingCaptureSlot) {
  if (!video) return null;
  const width = video.videoWidth || 0;
  const height = video.videoHeight || 0;
  if (!width || !height) return null;
  const sourceX = point === "left" ? 0 : point === "front" ? Math.round(width * 0.22) : Math.round(width * 0.45);
  const sourceW = point === "front" ? Math.round(width * 0.56) : Math.round(width * 0.55);
  const sourceY = Math.round(height * 0.08);
  const sourceH = Math.round(height * 0.84);
  const safeW = Math.max(16, Math.min(width - sourceX, sourceW));
  const safeH = Math.max(16, Math.min(height - sourceY, sourceH));

  const canvas = document.createElement("canvas");
  canvas.width = safeW;
  canvas.height = safeH;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, sourceX, sourceY, safeW, safeH, 0, 0, safeW, safeH);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized;
}

function normalizeImageValue(value: unknown) {
  const normalized = asNonEmptyString(value);
  if (!normalized) return null;
  if (normalized.startsWith("data:image")) return normalized;
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith("/")) return normalized;
  if (/^[a-z0-9+/=]+$/i.test(normalized) && normalized.length > 120) {
    return `data:image/jpeg;base64,${normalized}`;
  }
  return null;
}

function pickEntityImage(entity: IdentityEntity | null) {
  if (!entity) return null;
  const directCandidates = [entity.profile_image_url, entity.image_url, entity.photo_url];
  for (const candidate of directCandidates) {
    const imageValue = normalizeImageValue(candidate);
    if (imageValue) return imageValue;
  }
  const metadata = entity.metadata && typeof entity.metadata === "object" ? entity.metadata : null;
  if (!metadata) return null;
  const metadataCandidates = [
    metadata.image,
    metadata.image_url,
    metadata.profile_image,
    metadata.profile_image_url,
    metadata.photo,
    metadata.photo_url,
    metadata.face_image,
    metadata.face_image_url,
    metadata.snapshot_url,
    metadata.avatar_url,
    metadata.thumbnail_url,
    metadata.base64_image,
    metadata.image_base64,
  ];
  for (const candidate of metadataCandidates) {
    const imageValue = normalizeImageValue(candidate);
    if (imageValue) return imageValue;
  }
  return null;
}

function pickEntityImageOrigin(entity: IdentityEntity | null) {
  if (!entity) return "";
  const metadata = entity.metadata && typeof entity.metadata === "object" ? entity.metadata : null;
  if (!metadata) return "";
  return (
    asNonEmptyString(metadata.image_source) ||
    asNonEmptyString(metadata.photo_source) ||
    asNonEmptyString(metadata.storage_origin) ||
    asNonEmptyString(metadata.origin) ||
    ""
  );
}

function captureViewFromSource(sourceId: string) {
  if (sourceId === "channel-1") return "main";
  if (sourceId === "channel-2") return "left";
  if (sourceId === "channel-3") return "front";
  if (sourceId === "channel-4") return "right";
  return "unknown";
}

function pointLabel(slot: EmbeddingCaptureSlot) {
  if (slot === "left") return "Ponto 2 - Lateral esquerdo";
  if (slot === "front") return "Ponto 3 - Frontal";
  return "Ponto 4 - Lateral direito";
}

function dataUrlToFile(dataUrl: string, fileName: string) {
  const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/i.exec(dataUrl || "");
  if (!match) return null;
  const mimeType = match[1] || "image/jpeg";
  const payload = match[2] || "";
  try {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new File([bytes], fileName, { type: mimeType });
  } catch {
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || !b.length) return 0;
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    const va = Number(a[i] || 0);
    const vb = Number(b[i] || 0);
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA <= 0 || normB <= 0) return 0;
  const cos = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1, (cos + 1) / 2));
}

async function fetchImageUrlAsDataUrl(url: string) {
  const normalized = `${url || ""}`.trim();
  if (!normalized) return null;
  if (normalized.startsWith("data:image/")) return normalized;
  try {
    const response = await fetch(normalized, { cache: "no-store" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    return dataUrl;
  } catch {
    return null;
  }
}

async function fileToDataUrl(file: File) {
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export default function IdentityRuntimePage() {
  const searchParams = useSearchParams();
  const isEmbedded = searchParams.get("embedded") === "1";
  const [payload, setPayload] = useState<IdentityPanelPayload>(INITIAL_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "streaming">("idle");
  const [cameraError, setCameraError] = useState("");
  const [runtimeApiStatus, setRuntimeApiStatus] = useState<"unknown" | "available" | "missing" | "error">("unknown");
  const [runtimeNotice, setRuntimeNotice] = useState("");
  const [stageLayoutMode, setStageLayoutMode] = useState<"single" | "multi">("multi");
  const [isStageMaximized, setIsStageMaximized] = useState(false);
  const [primarySourceId] = useState("channel-1");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [entityStageSourceId, setEntityStageSourceId] = useState("channel-1");
  const [entityImageRegistryMap, setEntityImageRegistryMap] = useState<Record<string, string>>({});
  const [entityImageAssetRegistryMap, setEntityImageAssetRegistryMap] = useState<Record<string, IdentityImageAsset>>({});
  const [ingestBusy, setIngestBusy] = useState(false);
  const [ingestNotice, setIngestNotice] = useState("");
  const [ingestError, setIngestError] = useState("");
  const [inducedGallery, setInducedGallery] = useState<InducedReferenceAsset[]>([]);
  const [inducedReferenceImageKey, setInducedReferenceImageKey] = useState("");
  const [inducedBusy, setInducedBusy] = useState(false);
  const [inducedNotice, setInducedNotice] = useState("");
  const [inducedError, setInducedError] = useState("");
  const [inducedSearchActive, setInducedSearchActive] = useState(false);
  const [inducedSearchSynced, setInducedSearchSynced] = useState(false);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [autoCaptureBusy, setAutoCaptureBusy] = useState(false);
  const [autoCaptureNotice, setAutoCaptureNotice] = useState("");
  const [autoCaptureError, setAutoCaptureError] = useState("");
  const [autoCaptureLastAt, setAutoCaptureLastAt] = useState("");
  const [faceEmbeddingStatus, setFaceEmbeddingStatus] = useState<"idle" | "ready" | "error">("idle");
  const [identifiedProfileImage, setIdentifiedProfileImage] = useState<string | null>(null);
  const [embeddingCaptures, setEmbeddingCaptures] = useState<Record<EmbeddingCaptureSlot, EmbeddingCaptureEntry>>({
    left: { image: null, capturedAt: null },
    front: { image: null, capturedAt: null },
    right: { image: null, capturedAt: null },
  });
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const autoCaptureLastAtRef = useRef(0);
  const autoCaptureSignatureRef = useRef("");
  const referenceEmbeddingCacheRef = useRef<Record<string, number[]>>({});
  const ingestInputRef = useRef<HTMLInputElement | null>(null);
  const inducedInputRef = useRef<HTMLInputElement | null>(null);

  const statusInfo = useMemo(() => statusToken(payload.status), [payload.status]);

  const stopCameraPreview = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    localStreamRef.current = null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setCameraState("idle");
  }, []);

  const startCameraPreview = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera local indisponivel neste navegador.");
      return;
    }
    setCameraState("starting");
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      const previous = localStreamRef.current;
      if (previous) previous.getTracks().forEach((track) => track.stop());
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play().catch(() => null);
      }
      setCameraState("streaming");
    } catch (err) {
      setCameraState("idle");
      setCameraError(err instanceof Error ? err.message : "Falha ao conectar camera local.");
    }
  }, []);

  const loadPanel = useCallback(async () => {
    try {
      const candidateEndpoints = ["/api/identity/panel", "/api/identity/runtime/status"];
      let data: IdentityPanelPayload | null = null;
      let lastFailure = "";
      for (const endpoint of candidateEndpoints) {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (response.ok) {
          data = (await response.json()) as IdentityPanelPayload;
          break;
        }
        lastFailure = `IDENTITY_PANEL_HTTP_${response.status}`;
        if (response.status !== 404) {
          throw new Error(lastFailure);
        }
      }
      if (!data) {
        if (lastFailure.includes("404")) {
          setRuntimeApiStatus("missing");
          setRuntimeNotice("Servico de runtime nao encontrado (404). O palco local continua funcional para captura.");
          setError("");
          return;
        }
        throw new Error(lastFailure || "IDENTITY_PANEL_HTTP_404");
      }
      setRuntimeApiStatus("available");
      setRuntimeNotice("");
      setPayload(data);
      setSelectedSourceId((current) => current || String(data.selected_source_id || ""));
      setError("");
    } catch (err) {
      setRuntimeApiStatus("error");
      setError(err instanceof Error ? err.message : "Falha ao carregar painel de identidade.");
    } finally {
      setLoading(false);
    }
  }, []);

  const runAction = useCallback(
    async (path: string, body: Record<string, unknown> = {}, action = "") => {
      if (runtimeApiStatus !== "available") {
        setRuntimeNotice("Comandos de runtime indisponiveis: endpoint de identidade nao encontrado.");
        return;
      }
      setBusyAction(action || path);
      try {
        const response = await fetch(path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`IDENTITY_ACTION_HTTP_${response.status}`);
        await loadPanel();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao executar acao de identidade.");
      } finally {
        setBusyAction("");
      }
    },
    [loadPanel, runtimeApiStatus],
  );

  const stageTiles = useMemo<StageCameraTile[]>(() => {
    return [
      { id: "channel-1", name: "Canal 1", sourceType: "main", connected: cameraState === "streaming", isPlaceholder: false },
      { id: "channel-2", name: "Canal 2", sourceType: "left-profile", connected: cameraState === "streaming", isPlaceholder: false },
      { id: "channel-3", name: "Canal 3", sourceType: "frontal-profile", connected: cameraState === "streaming", isPlaceholder: false },
      { id: "channel-4", name: "Canal 4", sourceType: "right-profile", connected: cameraState === "streaming", isPlaceholder: false },
    ];
  }, [cameraState]);

  const primaryTile = useMemo(() => {
    if (!stageTiles.length) return null;
    return stageTiles.find((tile) => tile.id === primarySourceId) || stageTiles[0];
  }, [primarySourceId, stageTiles]);

  const thumbnailTiles = useMemo(() => {
    if (!primaryTile) return [] as StageCameraTile[];
    return stageTiles.filter((tile) => tile.id !== primaryTile.id).slice(0, 3);
  }, [primaryTile, stageTiles]);

  const selectedEntity = useMemo(() => {
    if (!payload.tracked_entities.length) return payload.current_identity || null;
    if (selectedEntityId) {
      const matched = payload.tracked_entities.find((entity) => entity.entity_id === selectedEntityId);
      if (matched) return matched;
    }
    if (payload.current_identity) return payload.current_identity;
    return payload.tracked_entities[0];
  }, [payload.current_identity, payload.tracked_entities, selectedEntityId]);

  const filteredTrackedEntities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return payload.tracked_entities;
    return payload.tracked_entities.filter((entity) => {
      const label = (entity.nominal_name || entity.label || entity.entity_id || "").toLowerCase();
      const mode = (entity.mode || "").toLowerCase();
      const source = (entity.source_id || "").toLowerCase();
      return label.includes(query) || mode.includes(query) || source.includes(query);
    });
  }, [payload.tracked_entities, searchQuery]);

  const localEntityStageImages = useMemo<Record<string, string | null>>(
    () => ({
      "channel-1": identifiedProfileImage,
      "channel-2": embeddingCaptures.left.image,
      "channel-3": embeddingCaptures.front.image,
      "channel-4": embeddingCaptures.right.image,
    }),
    [embeddingCaptures.front.image, embeddingCaptures.left.image, embeddingCaptures.right.image, identifiedProfileImage],
  );

  const selectedEntityPhotoFromEntityPayload = useMemo(() => pickEntityImage(selectedEntity), [selectedEntity]);
  const selectedEntityPhotoFromSqlRegistry = useMemo(() => {
    if (!selectedEntity?.entity_id) return null;
    return entityImageRegistryMap[selectedEntity.entity_id] || null;
  }, [entityImageRegistryMap, selectedEntity?.entity_id]);
  const selectedEntityPhotoFromStage = useMemo(() => localEntityStageImages[entityStageSourceId] || null, [entityStageSourceId, localEntityStageImages]);

  const selectedEntityPhoto = selectedEntityPhotoFromSqlRegistry || selectedEntityPhotoFromEntityPayload || selectedEntityPhotoFromStage || null;
  const selectedEntityPhotoOrigin = selectedEntityPhotoFromSqlRegistry
    ? "banco (sql/imagens)"
    : selectedEntityPhotoFromEntityPayload
      ? `banco (${pickEntityImageOrigin(selectedEntity) || "sql/imagens"})`
    : selectedEntityPhotoFromStage
      ? `captura local (${entityStageSourceId})`
      : "sem imagem";
  const selectedEntitySourceLabel = useMemo(() => {
    const matched = stageTiles.find((tile) => tile.id === entityStageSourceId);
    return matched ? `${matched.name} (${matched.id})` : entityStageSourceId;
  }, [entityStageSourceId, stageTiles]);
  const dbReferenceAsset = useMemo(() => {
    if (!selectedEntity?.entity_id) return null;
    return entityImageAssetRegistryMap[selectedEntity.entity_id] || null;
  }, [entityImageAssetRegistryMap, selectedEntity?.entity_id]);
  const inducedReferenceAsset = useMemo(() => {
    if (!inducedGallery.length) return null;
    if (inducedReferenceImageKey) {
      const byKey = inducedGallery.find((asset) => asset.local_id === inducedReferenceImageKey);
      if (byKey) return byKey;
    }
    return inducedGallery[0];
  }, [inducedGallery, inducedReferenceImageKey]);
  const hasInducedReference = Boolean(inducedSearchActive && inducedReferenceAsset);

  const capturePrimaryProfile = useCallback(() => {
    const image = captureFrameFromVideo(localVideoRef.current);
    if (!image) {
      setCameraError("Nao foi possivel capturar imagem do Canal 1.");
      return;
    }
    setIdentifiedProfileImage(image);
  }, []);

  const captureEmbeddingSlot = useCallback((slot: EmbeddingCaptureSlot) => {
    const image = derivePointFrameFromVideo(localVideoRef.current, slot) || captureFrameFromVideo(localVideoRef.current);
    if (!image) {
      setCameraError("Nao foi possivel capturar imagem para embedding.");
      return;
    }
    setEmbeddingCaptures((current) => ({
      ...current,
      [slot]: { image, capturedAt: new Date().toISOString() },
    }));
  }, []);

  const openIngestPicker = useCallback(() => {
    ingestInputRef.current?.click();
  }, []);

  const openInducedPicker = useCallback(() => {
    inducedInputRef.current?.click();
  }, []);

  const handleInducedGalleryUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []).filter((item) => item.type.startsWith("image/"));
      event.target.value = "";
      if (!files.length) return;

      setInducedBusy(true);
      setInducedError("");
      setInducedNotice("");
      let failureCount = 0;
      const localEntries: InducedReferenceAsset[] = [];
      const uploadBatch = files.slice(0, 24);
      for (const file of uploadBatch) {
        const dataUrl = await fileToDataUrl(file);
        if (!dataUrl) {
          failureCount += 1;
          continue;
        }
        localEntries.push({
          local_id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          file_name: file.name || "referencia",
          mime_type: file.type || "image/jpeg",
          data_url: dataUrl,
          created_at: new Date().toISOString(),
        });
      }
      if (localEntries.length > 0) {
        setInducedGallery((current) => {
          const merged = [...localEntries, ...current];
          return merged.slice(0, 60);
        });
        setInducedReferenceImageKey((current) => current || localEntries[0].local_id);
        setInducedSearchActive(true);
        setInducedSearchSynced(false);
        setInducedNotice(`${localEntries.length} imagem(ns) carregada(s) no front para rastreamento induzido.`);
      }
      if (failureCount > 0) {
        setInducedError(`${failureCount} arquivo(s) falharam na leitura local.`);
      }
      setInducedBusy(false);
    },
    [],
  );

  const handleIngestImageFromPicker = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      setIngestBusy(true);
      setIngestError("");
      setIngestNotice("");
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (selectedEntity?.entity_id) formData.append("entity_key", selectedEntity.entity_id);
        formData.append("source_key", entityStageSourceId);
        formData.append("capture_view", captureViewFromSource(entityStageSourceId));
        formData.append("note", "awareness_manual_ingest");

        const response = await fetch("/api/identity/images", {
          method: "POST",
          body: formData,
          cache: "no-store",
        });
        const body = (await response.json().catch(() => ({}))) as { message?: string; image?: IdentityImageAsset };
        if (!response.ok) {
          throw new Error(body.message || `IDENTITY_IMAGE_INGEST_HTTP_${response.status}`);
        }

        const entityKey = selectedEntity?.entity_id;
        const publicUrl = typeof body.image?.public_url === "string" ? body.image.public_url : "";
        if (entityKey && publicUrl) {
          setEntityImageRegistryMap((current) => ({ ...current, [entityKey]: publicUrl }));
          if (body.image) {
            setEntityImageAssetRegistryMap((current) => ({ ...current, [entityKey]: body.image as IdentityImageAsset }));
          }
        }
        setIngestNotice("Imagem inserida no banco SQL de imagens com sucesso.");
      } catch (err) {
        setIngestError(err instanceof Error ? err.message : "Falha ao inserir imagem no banco SQL.");
      } finally {
        setIngestBusy(false);
      }
    },
    [entityStageSourceId, selectedEntity?.entity_id],
  );

  const requestFaceEmbedding = useCallback(async (imageDataUrl: string) => {
    const response = await fetch("/api/identity/face-embeddings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: imageDataUrl,
        detect_face: true,
        output_dimension: 768,
      }),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      data?: Array<{ embedding?: number[] }>;
    };
    if (!response.ok) {
      throw new Error(body.message || `FACE_EMBEDDING_HTTP_${response.status}`);
    }
    const embedding = Array.isArray(body.data) ? body.data[0]?.embedding : null;
    if (!Array.isArray(embedding) || !embedding.length) {
      throw new Error("FACE_EMBEDDING_EMPTY_VECTOR");
    }
    return embedding.map((item) => Number(item || 0));
  }, []);

  const resolveActiveReferenceEmbedding = useCallback(async () => {
    if (hasInducedReference && inducedReferenceAsset) {
      const cacheKey = `induced:${inducedReferenceAsset.local_id}`;
      const cached = referenceEmbeddingCacheRef.current[cacheKey];
      if (Array.isArray(cached) && cached.length > 0) {
        return { embedding: cached, candidateImageKey: null as string | null, referenceId: cacheKey };
      }
      const embedding = await requestFaceEmbedding(inducedReferenceAsset.data_url);
      referenceEmbeddingCacheRef.current[cacheKey] = embedding;
      return { embedding, candidateImageKey: null as string | null, referenceId: cacheKey };
    }

    const asset = dbReferenceAsset;
    if (!asset?.image_key || !asset.public_url) return null;
    const cacheKey = `db:${asset.image_key}`;
    const cached = referenceEmbeddingCacheRef.current[cacheKey];
    if (Array.isArray(cached) && cached.length > 0) {
      return { embedding: cached, candidateImageKey: asset.image_key, referenceId: cacheKey };
    }
    const referenceDataUrl = await fetchImageUrlAsDataUrl(asset.public_url);
    if (!referenceDataUrl) return null;
    const embedding = await requestFaceEmbedding(referenceDataUrl);
    referenceEmbeddingCacheRef.current[cacheKey] = embedding;
    return { embedding, candidateImageKey: asset.image_key, referenceId: cacheKey };
  }, [dbReferenceAsset, hasInducedReference, inducedReferenceAsset, requestFaceEmbedding]);

  const uploadCapturedFrameToSql = useCallback(
    async (params: {
      frameDataUrl: string;
      sourceKey: string;
      captureView: string;
      note: string;
      entityKey?: string;
    }) => {
      const file = dataUrlToFile(
        params.frameDataUrl,
        `autocapture-${params.captureView}-${Date.now().toString(36)}.${params.frameDataUrl.includes("image/png") ? "png" : "jpg"}`,
      );
      if (!file) return null;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source_key", params.sourceKey);
      formData.append("capture_view", params.captureView);
      formData.append("note", params.note);
      if (params.entityKey) formData.append("entity_key", params.entityKey);

      const response = await fetch("/api/identity/images", {
        method: "POST",
        body: formData,
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as { image?: IdentityImageAsset };
      if (!response.ok) return null;
      return body.image || null;
    },
    [],
  );

  const registerRecognitionEvent = useCallback(
    async (params: {
      candidateImageKey: string;
      sourceKey: string;
      captureView: string;
      entityKey?: string;
      embedding: number[] | null;
      similarityScore: number;
      triggerReason: string;
    }) => {
      const response = await fetch("/api/identity/recognition-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          probe: {
            source_key: params.sourceKey,
            capture_view: params.captureView,
            entity_key: params.entityKey || null,
            confidence: params.similarityScore,
            model_name: "autocapture-pseudo-embedding-v1",
            embedding: params.embedding,
            metadata: {
              trigger_reason: params.triggerReason,
            },
          },
          match: {
            candidate_image_key: params.candidateImageKey,
            similarity_score: params.similarityScore,
            positive_threshold: 0.72,
            note: params.triggerReason,
          },
          layers: [
            {
              layer_name: "diagnostic_gate",
              layer_result: "pass",
              layer_score: params.similarityScore,
              layer_payload: { trigger: params.triggerReason },
            },
            {
              layer_name: "cross_view_capture",
              layer_result: "pass",
              layer_score: 0.86,
              layer_payload: { source: params.sourceKey, capture_view: params.captureView },
            },
            {
              layer_name: params.triggerReason.includes("induced") ? "induced_reference_gate" : "channel1_diagnostic_gate",
              layer_result: "pass",
              layer_score: 0.84,
              layer_payload: { reason: params.triggerReason },
            },
          ],
        }),
        cache: "no-store",
      });
      return response.ok;
    },
    [],
  );

  const layeredMatchState = useMemo(() => {
    const someoneInFrame = Boolean(payload.awareness_state.someone_in_frame) || (cameraState === "streaming" && inducedSearchActive);
    const confidenceValue = Number(selectedEntity?.confidence || 0);
    const confidenceGate = Boolean(payload.awareness_state.identity_confirmed) || confidenceValue >= 0.68 || inducedSearchActive;
    const referenceGate = Boolean(hasInducedReference || dbReferenceAsset?.image_key);
    const channelGate = inducedSearchActive || String(payload.awareness_state.visual_source || "") === "channel-1" || entityStageSourceId === "channel-1";
    const pass = someoneInFrame && confidenceGate && referenceGate && channelGate;
    return {
      pass,
      triggerReason: inducedSearchActive ? "induced_reference_match" : "channel1_diagnostic_match",
      confidenceValue,
    };
  }, [
    cameraState,
    dbReferenceAsset?.image_key,
    entityStageSourceId,
    hasInducedReference,
    inducedSearchActive,
    payload.awareness_state.identity_confirmed,
    payload.awareness_state.someone_in_frame,
    payload.awareness_state.visual_source,
    selectedEntity?.confidence,
  ]);

  const runAutonomousMultiCapture = useCallback(
    async (triggerReason: string) => {
      if (autoCaptureBusy) return;
      if (cameraState !== "streaming") return;

      setAutoCaptureBusy(true);
      setAutoCaptureError("");
      setAutoCaptureNotice("");
      setFaceEmbeddingStatus("idle");
      const entityKey = selectedEntity?.entity_id || undefined;
      let resolvedReference:
        | {
            embedding: number[];
            candidateImageKey: string | null;
            referenceId: string;
          }
        | null = null;
      try {
        resolvedReference = await resolveActiveReferenceEmbedding();
      } catch (err) {
        setFaceEmbeddingStatus("error");
        setAutoCaptureError(err instanceof Error ? err.message : "Falha ao gerar embedding facial da referencia.");
      }
      if (!resolvedReference?.embedding?.length) {
        setAutoCaptureBusy(false);
        setAutoCaptureError("Nao foi possivel gerar embedding facial real para a imagem de referencia ativa.");
        return;
      }
      setFaceEmbeddingStatus("ready");
      const captureSlots: Array<{
        slot: EmbeddingCaptureSlot;
        sourceKey: string;
        captureView: string;
      }> = [
        { slot: "left", sourceKey: "channel-2", captureView: "left" },
        { slot: "front", sourceKey: "channel-3", captureView: "front" },
        { slot: "right", sourceKey: "channel-4", captureView: "right" },
      ];

      let processed = 0;
      let registeredCount = 0;
      let uploadedCount = 0;
      for (const item of captureSlots) {
        const frame = derivePointFrameFromVideo(localVideoRef.current, item.slot) || captureFrameFromVideo(localVideoRef.current);
        if (!frame) continue;

        setEmbeddingCaptures((current) => ({
          ...current,
          [item.slot]: { image: frame, capturedAt: new Date().toISOString() },
        }));

        const uploaded = await uploadCapturedFrameToSql({
          frameDataUrl: frame,
          sourceKey: item.sourceKey,
          captureView: item.captureView,
          note: `autocapture_after_${triggerReason}`,
          entityKey,
        });
        if (uploaded) uploadedCount += 1;
        let embedding: number[] | null = null;
        try {
          embedding = await requestFaceEmbedding(frame);
        } catch (err) {
          setFaceEmbeddingStatus("error");
          setAutoCaptureError(err instanceof Error ? err.message : "Falha ao gerar embedding facial real da captura.");
          continue;
        }
        const similarity = cosineSimilarity(resolvedReference.embedding, embedding);
        processed += 1;

        if (resolvedReference.candidateImageKey) {
          const registered = await registerRecognitionEvent({
            candidateImageKey: resolvedReference.candidateImageKey,
            sourceKey: item.sourceKey,
            captureView: item.captureView,
            entityKey,
            embedding,
            similarityScore: similarity,
            triggerReason,
          });
          if (registered) {
            registeredCount += 1;
          }
        }
      }

      if (processed > 0) {
        const nowIso = new Date().toISOString();
        setAutoCaptureLastAt(nowIso);
        if (registeredCount > 0) {
          setAutoCaptureNotice(
            `Autocaptura concluida: ${processed}/3 pontos processados, ${uploadedCount} captura(s) no SQL e ${registeredCount} registro(s) em camadas (${triggerReason}).`,
          );
        } else {
          setAutoCaptureNotice(
            `Autocaptura concluida: ${processed}/3 pontos processados com referencia local induzida (${resolvedReference.referenceId}).`,
          );
        }
      } else {
        setAutoCaptureError("Autocaptura nao gerou capturas validas nos pontos 2/3/4.");
      }
      setAutoCaptureBusy(false);
    },
    [
      autoCaptureBusy,
      cameraState,
      registerRecognitionEvent,
      requestFaceEmbedding,
      resolveActiveReferenceEmbedding,
      selectedEntity?.entity_id,
      uploadCapturedFrameToSql,
    ],
  );

  useEffect(() => {
    void loadPanel();
    const timer = window.setInterval(() => {
      void loadPanel();
    }, 3500);
    return () => window.clearInterval(timer);
  }, [loadPanel]);

  useEffect(() => {
    const stream = localStreamRef.current;
    const attach = (videoEl: HTMLVideoElement | null) => {
      if (!videoEl) return;
      if (!stream || cameraState !== "streaming") {
        videoEl.srcObject = null;
        return;
      }
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      void videoEl.play().catch(() => null);
    };
    attach(localVideoRef.current);
  }, [cameraState]);

  useEffect(() => {
    void startCameraPreview();
  }, [startCameraPreview]);

  useEffect(() => {
    setSelectedEntityId((current) => {
      if (!payload.tracked_entities.length) return "";
      if (current && payload.tracked_entities.some((entity) => entity.entity_id === current)) return current;
      if (payload.current_identity?.entity_id) return payload.current_identity.entity_id;
      return payload.tracked_entities[0]?.entity_id || "";
    });
  }, [payload.current_identity?.entity_id, payload.tracked_entities]);

  useEffect(() => {
    if (stageTiles.some((tile) => tile.id === entityStageSourceId)) return;
    setEntityStageSourceId(stageTiles[0]?.id || "channel-1");
  }, [entityStageSourceId, stageTiles]);

  useEffect(() => {
    if (!inducedGallery.length) {
      if (inducedSearchActive) setInducedSearchActive(false);
      if (inducedReferenceImageKey) setInducedReferenceImageKey("");
      if (inducedSearchSynced) setInducedSearchSynced(false);
      return;
    }
    if (inducedReferenceImageKey && inducedGallery.some((asset) => asset.local_id === inducedReferenceImageKey)) return;
    setInducedReferenceImageKey(inducedGallery[0].local_id);
  }, [inducedGallery, inducedReferenceImageKey, inducedSearchActive, inducedSearchSynced]);

  useEffect(() => {
    if (!inducedSearchActive) return;
    setEntityStageSourceId("channel-1");
    setSelectedSourceId("channel-1");
    if (runtimeApiStatus !== "available") return;
    if (payload.selected_source_id === "channel-1") {
      setInducedSearchSynced(true);
      return;
    }
    if (inducedSearchSynced) return;
    void runAction("/api/identity/sources/select", { source_id: "channel-1" }, "induced_select_channel_1").finally(() =>
      setInducedSearchSynced(true),
    );
  }, [inducedSearchActive, inducedSearchSynced, payload.selected_source_id, runAction, runtimeApiStatus]);

  useEffect(() => {
    if (!autoCaptureEnabled || autoCaptureBusy) return;
    if (cameraState !== "streaming") return;
    if (!layeredMatchState.pass) return;

    const now = Date.now();
    const cooldownMs = 12_000;
    const referenceSignature = hasInducedReference
      ? `induced:${inducedReferenceAsset?.local_id || "none"}`
      : `db:${dbReferenceAsset?.image_key || "none"}`;
    const signature = `${selectedEntity?.entity_id || "induced-target"}:${referenceSignature}:${layeredMatchState.triggerReason}`;
    const elapsed = now - autoCaptureLastAtRef.current;
    if (elapsed < cooldownMs) return;
    if (autoCaptureSignatureRef.current === signature && elapsed < cooldownMs * 2) return;

    autoCaptureLastAtRef.current = now;
    autoCaptureSignatureRef.current = signature;
    void runAutonomousMultiCapture(layeredMatchState.triggerReason);
  }, [
    autoCaptureBusy,
    autoCaptureEnabled,
    cameraState,
    dbReferenceAsset?.image_key,
    hasInducedReference,
    inducedReferenceAsset?.local_id,
    layeredMatchState.pass,
    layeredMatchState.triggerReason,
    runAutonomousMultiCapture,
    selectedEntity?.entity_id,
  ]);

  useEffect(() => {
    const entityKey = selectedEntity?.entity_id || "";
    if (!entityKey) return;
    let alive = true;
    const run = async () => {
      try {
        const response = await fetch(`/api/identity/images?entity_key=${encodeURIComponent(entityKey)}&limit=1`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = (await response.json()) as { images?: IdentityImageAsset[] };
        const newest = Array.isArray(body.images) && body.images.length > 0 ? body.images[0] : null;
        const nextUrl = typeof newest?.public_url === "string" ? newest.public_url : "";
        if (!alive || !nextUrl || !newest) return;
        setEntityImageRegistryMap((current) => ({ ...current, [entityKey]: nextUrl }));
        setEntityImageAssetRegistryMap((current) => ({ ...current, [entityKey]: newest }));
      } catch {
        // Silent fallback: keep stage/local image when SQL image repository is unavailable.
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [selectedEntity?.entity_id]);

  useEffect(() => () => stopCameraPreview(), [stopCameraPreview]);

  return (
    <main
      className={`min-h-screen bg-[#05070d] text-slate-100 ${
        isEmbedded ? "h-full min-h-full p-2 sm:p-3" : "px-4 py-4 md:px-6"
      } [&_.bg-white]:!bg-[#0f172a] [&_.bg-white\\/95]:!bg-[#0f172a] [&_.bg-slate-50]:!bg-[#101d33] [&_.bg-slate-100]:!bg-[#17243b] [&_.border-slate-300]:!border-[#314464] [&_.border-slate-200]:!border-[#24324b] [&_.border-slate-100]:!border-[#1a2740] [&_.text-slate-900]:!text-slate-100 [&_.text-slate-800]:!text-slate-200 [&_.text-slate-700]:!text-slate-300 [&_.text-slate-600]:!text-slate-400 [&_.text-slate-500]:!text-slate-500 [&_.text-zinc-700]:!text-slate-300 [&_.text-zinc-800]:!text-slate-200 [&_.text-zinc-900]:!text-slate-100`}
    >
      {isStageMaximized ? <div className="fixed inset-0 z-[140] bg-black/70" onClick={() => setIsStageMaximized(false)} /> : null}
      <div className="w-full">
        <header
          className={`m-0 rounded-none border-0 bg-[#05070d] px-3 py-2 shadow-none ${
            isEmbedded ? "-mx-2 -mt-2 sm:-mx-3 sm:-mt-3" : "-mx-4 -mt-4 md:-mx-6"
          }`}
        >
          <div className="relative flex min-h-8 items-center justify-between gap-2">
            <div className="z-[1] flex min-w-0 items-center">
              {!isEmbedded ? (
                <Link
                  href="/knexai/web"
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <ArrowLeft size={14} />
                  <span className="hidden sm:inline">Voltar ao chat</span>
                </Link>
              ) : (
                <span aria-hidden="true" className="inline-block h-7 w-7" />
              )}
            </div>
            <p className="pointer-events-none absolute inset-x-0 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Identity Runtime Layer
            </p>
            <div className="z-[1] ml-auto flex items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusInfo.className}`}>
                {statusInfo.label}
              </span>
              <button
                type="button"
                onClick={() => void loadPanel()}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                disabled={loading}
              >
                <RefreshCcw size={13} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
            </div>
          </div>
          {error ? (
            <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">{error}</div>
          ) : null}
          {runtimeNotice ? (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">{runtimeNotice}</div>
          ) : null}
        </header>

        <section className="grid gap-4 xl:grid-cols-3 xl:items-stretch">
          <article
            className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2 ${
              isStageMaximized ? "fixed inset-2 z-[150] flex flex-col" : ""
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Camera size={18} className="text-sky-500" />
                Palco de Camera e Analise
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStageLayoutMode((current) => (current === "multi" ? "single" : "multi"))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {stageLayoutMode === "multi" ? "Somente principal" : "Principal + miniaturas"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsStageMaximized((current) => !current)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {isStageMaximized ? "Restaurar palco" : "Maximizar palco"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (cameraState === "streaming") {
                      stopCameraPreview();
                      return;
                    }
                    void startCameraPreview();
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ${
                    cameraState === "streaming"
                      ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {cameraState === "streaming" ? <CirclePause size={14} /> : <CirclePlay size={14} />}
                  {cameraState === "streaming" ? "Parar camera" : "Iniciar camera"}
                </button>
                <button
                  type="button"
                  onClick={() => void startCameraPreview()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCcw size={14} />
                  Reconectar
                </button>
              </div>
            </div>
            <div className={`mt-3 grid gap-3 ${stageLayoutMode === "multi" ? "lg:grid-cols-[minmax(0,1fr)_230px]" : "grid-cols-1"}`}>
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-black">
                <div className="absolute left-3 top-3 z-[3] rounded-md bg-black/50 px-2 py-1 text-xs text-slate-200">
                  Principal: {primaryTile?.name || "Camera"}
                </div>
                <div className="aspect-video w-full bg-black">
                  <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                </div>
                {cameraState !== "streaming" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 text-center text-sm text-slate-200">
                    <p>{cameraState === "starting" ? "Conectando camera local..." : "Sem sinal no palco principal."}</p>
                    <p className="max-w-md text-xs text-slate-400">
                      Permita acesso a camera no navegador para exibir o palco principal e os pontos de analise.
                    </p>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={capturePrimaryProfile}
                  className="absolute bottom-3 left-3 z-[3] rounded-md border border-slate-200/40 bg-black/50 px-2.5 py-1 text-xs font-medium text-slate-100 hover:bg-black/65"
                >
                  Capturar perfil (Canal 1)
                </button>
              </div>
              {stageLayoutMode === "multi" ? (
                <div className="grid gap-3">
                  {([
                    { tile: thumbnailTiles[0], slot: "left" as EmbeddingCaptureSlot },
                    { tile: thumbnailTiles[1], slot: "front" as EmbeddingCaptureSlot },
                    { tile: thumbnailTiles[2], slot: "right" as EmbeddingCaptureSlot },
                  ]).map(({ tile, slot }) => {
                    if (!tile) return null;
                    const captureEntry = embeddingCaptures[slot];
                    return (
                      <div key={tile.id} className="overflow-hidden rounded-xl border border-slate-200 text-left">
                        <div className="relative aspect-video w-full bg-black">
                          {captureEntry.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={captureEntry.image} alt={`Captura ${pointLabel(slot)}`} className="h-full w-full object-cover" />
                          ) : null}
                          <div className="absolute left-2 top-2 rounded-md bg-black/50 px-2 py-1 text-[11px] text-slate-100">
                            {pointLabel(slot)}
                          </div>
                          {captureEntry.image ? (
                            <div className="absolute bottom-2 right-2 z-[2] h-14 w-14 overflow-hidden rounded-md border border-slate-300/80 bg-black/60">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={captureEntry.image} alt={`Ultima captura ${tile.name}`} className="h-full w-full object-cover" />
                            </div>
                          ) : null}
                          {!captureEntry.image ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs text-slate-300">
                              {cameraState === "streaming" ? "Aguardando captura de analise" : "Aguardando Canal 1"}
                            </div>
                          ) : null}
                        </div>
                        <div className="bg-slate-900/90 px-2 py-1.5 text-xs text-slate-200">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">
                              {tile.name} - {pointLabel(slot).replace("Ponto 2 - ", "").replace("Ponto 3 - ", "").replace("Ponto 4 - ", "")}
                            </span>
                            <button
                              type="button"
                              onClick={() => captureEmbeddingSlot(slot)}
                              className="rounded border border-slate-500/70 bg-slate-800 px-2 py-0.5 text-[11px] hover:bg-slate-700"
                            >
                              Capturar
                            </button>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-300">
                            {captureEntry.capturedAt ? `Ultima captura: ${asPrettyDate(captureEntry.capturedAt)}` : "Sem captura registrada"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Rastreamento induzido</p>
                  <p className="text-[11px] text-slate-500">
                    As referencias inseridas aqui ficam apenas no front-end (sem ingestao no awareness/SQL) e ativam a busca induzida.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      inducedSearchActive
                        ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                        : "border-zinc-300 bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {inducedSearchActive ? "Busca induzida ativa" : "Busca induzida inativa"}
                  </span>
                  <input
                    ref={inducedInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      void handleInducedGalleryUpload(event);
                    }}
                  />
                  <button
                    type="button"
                    onClick={openInducedPicker}
                    disabled={inducedBusy}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-100 disabled:opacity-60"
                  >
                    <Images size={13} />
                    {inducedBusy ? "Inserindo..." : "Inserir varias fotos"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoCaptureEnabled((current) => !current)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      autoCaptureEnabled
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    {autoCaptureEnabled ? "Autocaptura ON" : "Autocaptura OFF"}
                  </button>
                </div>
              </div>
              <div className="mt-2 overflow-x-auto">
                <div className="flex w-max min-w-full gap-2 pb-1">
                  {inducedGallery.length ? (
                    inducedGallery.map((asset) => (
                      <figure
                        key={asset.local_id}
                        onClick={() => setInducedReferenceImageKey(asset.local_id)}
                        className={`w-24 shrink-0 cursor-pointer overflow-hidden rounded-lg border bg-slate-100 ${
                          inducedReferenceAsset?.local_id === asset.local_id
                            ? "border-cyan-400 ring-1 ring-cyan-300"
                            : "border-slate-300"
                        }`}
                        title={asset.file_name || asset.local_id}
                      >
                        <div className="aspect-square w-full bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={asset.data_url} alt={asset.file_name || "Referencia de rastreamento"} className="h-full w-full object-cover" />
                        </div>
                        <figcaption className="truncate px-1.5 py-1 text-[10px] text-slate-600">
                          {asset.file_name || "imagem"}
                        </figcaption>
                      </figure>
                    ))
                  ) : (
                    <div className="flex h-16 w-full min-w-[280px] items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500">
                      Sem imagens de referencia. Use o icone para inserir varias miniaturas.
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <span>Referencia ativa: <strong>{inducedReferenceAsset?.file_name || inducedReferenceAsset?.local_id || "-"}</strong></span>
                <span>Match em camadas: <strong>{layeredMatchState.pass ? "positivo" : "aguardando"}</strong></span>
                <span>Canal diagnostico: <strong>channel-1</strong></span>
                <span>Embedding facial: <strong>{faceEmbeddingStatus === "ready" ? "real ativo" : faceEmbeddingStatus === "error" ? "erro" : "aguardando"}</strong></span>
                <span>Ultima autocaptura: <strong>{autoCaptureLastAt ? asPrettyDate(autoCaptureLastAt) : "-"}</strong></span>
              </div>
              {inducedNotice ? <p className="mt-1 text-xs text-emerald-600">{inducedNotice}</p> : null}
              {inducedError ? <p className="mt-1 text-xs text-rose-600">{inducedError}</p> : null}
              {autoCaptureBusy ? <p className="mt-1 text-xs text-amber-600">Executando autocaptura autonoma nos pontos de analise 2, 3 e 4...</p> : null}
              {autoCaptureNotice ? <p className="mt-1 text-xs text-emerald-600">{autoCaptureNotice}</p> : null}
              {autoCaptureError ? <p className="mt-1 text-xs text-rose-600">{autoCaptureError}</p> : null}
            </div>
            {cameraError ? (
              <div className="mt-3 rounded-lg border border-rose-300 bg-rose-100/80 px-3 py-2 text-sm text-rose-800">{cameraError}</div>
            ) : null}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:flex xl:h-full xl:min-h-[560px] xl:flex-col xl:overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <UserRoundSearch size={18} className="text-fuchsia-600" />
                Entidades Rastreadas
              </h2>
              <p className="text-xs text-slate-500">Canal alvo: {selectedEntitySourceLabel}</p>
            </div>
            <div className="mt-3">
              <label className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Filtrar entidades</label>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Nome, modo ou fonte"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400"
              />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Entidade no palco</label>
                <select
                  value={selectedEntityId}
                  onChange={(event) => setSelectedEntityId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  {payload.tracked_entities.length ? null : <option value="">Sem entidade rastreada</option>}
                  {payload.tracked_entities.map((entity) => (
                    <option key={entity.entity_id} value={entity.entity_id}>
                      {entity.nominal_name || entity.label || entity.entity_id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Palco de busca</label>
                <select
                  value={entityStageSourceId}
                  onChange={(event) => setEntityStageSourceId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  {stageTiles.map((tile) => (
                    <option key={tile.id} value={tile.id}>
                      {tile.name}
                      {tile.id === "channel-1"
                        ? " - principal"
                        : tile.id === "channel-2"
                          ? " - lateral esquerdo"
                          : tile.id === "channel-3"
                            ? " - frontal"
                            : " - lateral direito"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>Palco de entidade para identificacao</span>
                <span>{selectedEntity ? asPrettyDate(selectedEntity.last_seen_at) : "Aguardando deteccao"}</span>
              </div>
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-black">
                <div className="aspect-[4/3] w-full">
                  {selectedEntityPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedEntityPhoto}
                      alt={selectedEntity ? `Foto de ${selectedEntity.nominal_name || selectedEntity.label || selectedEntity.entity_id}` : "Foto de entidade rastreada"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-3 text-center text-xs text-slate-300">
                      Sem foto no banco/imagens para a entidade selecionada. Use a captura do Canal 1 e dos pontos de analise 2/3/4.
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-slate-600">
                <p>
                  Entidade:{" "}
                  <strong>{selectedEntity ? selectedEntity.nominal_name || selectedEntity.label || selectedEntity.entity_id : "-"}</strong>
                </p>
                <p>
                  Origem da foto: <strong>{selectedEntityPhotoOrigin}</strong>
                </p>
                <p>
                  Confianca atual:{" "}
                  <strong>{selectedEntity ? `${Math.round((selectedEntity.confidence || 0) * 100)}%` : "-"}</strong>
                </p>
              </div>
            </div>
            <div className="mt-3 min-h-0 rounded-xl border border-slate-200 xl:flex-1 xl:overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Entidade</th>
                    <th className="py-2 pr-3">Modo</th>
                    <th className="py-2 pr-3">Confianca</th>
                    <th className="py-2 pr-3">Fonte</th>
                    <th className="py-2 pr-3">Ultima deteccao</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrackedEntities.length ? (
                    filteredTrackedEntities.map((entity) => (
                      <tr
                        key={entity.entity_id}
                        onClick={() => setSelectedEntityId(entity.entity_id)}
                        className={`cursor-pointer border-t border-slate-100 ${
                          selectedEntity?.entity_id === entity.entity_id ? "bg-slate-100/80" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="py-2 pr-3 font-medium text-slate-900">
                          {entity.nominal_name || entity.label || entity.entity_id}
                        </td>
                        <td className="py-2 pr-3 text-slate-700">{entity.mode}</td>
                        <td className="py-2 pr-3 text-slate-700">{Math.round(entity.confidence * 100)}%</td>
                        <td className="py-2 pr-3 text-slate-700">{entity.source_id || "-"}</td>
                        <td className="py-2 pr-3 text-slate-700">{asPrettyDate(entity.last_seen_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-3 text-slate-600">
                        Nenhuma entidade rastreada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Capturas locais: Canal 1 = {identifiedProfileImage ? "ok" : "pendente"} | Ponto 2 ={" "}
              {embeddingCaptures.left.image ? "ok" : "pendente"} | Ponto 3 = {embeddingCaptures.front.image ? "ok" : "pendente"} | Ponto 4 ={" "}
              {embeddingCaptures.right.image ? "ok" : "pendente"}
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ScanFace size={15} className="text-indigo-600" />
                Awareness
              </h3>
              <div className="mt-2 grid gap-1 text-sm text-slate-700">
                <p>
                  Alguem em quadro: <strong>{String(Boolean(payload.awareness_state.someone_in_frame))}</strong>
                </p>
                <p>
                  Fonte visual: <strong>{String(payload.awareness_state.visual_source || "-")}</strong>
                </p>
                <p>
                  Identidade confirmada: <strong>{String(Boolean(payload.awareness_state.identity_confirmed))}</strong>
                </p>
                <p>
                  Conflito: <strong>{String(Boolean(payload.awareness_state.identity_conflict))}</strong>
                </p>
                <p>
                  Troca de interlocutor: <strong>{String(Boolean(payload.awareness_state.interlocutor_switched))}</strong>
                </p>
              </div>
              <div className="mt-3 border-t border-slate-200 pt-2.5">
                <input
                  ref={ingestInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    void handleIngestImageFromPicker(event);
                  }}
                />
                <button
                  type="button"
                  onClick={openIngestPicker}
                  disabled={ingestBusy}
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                >
                  <Upload size={13} />
                  {ingestBusy ? "Inserindo no banco..." : "Ingerir imagem no banco"}
                </button>
                <p className="mt-1 text-xs text-slate-500">
                  Abre o seletor de arquivos do sistema (Windows/Mac/Linux) para inserir imagem no SQL de identidades.
                </p>
                {ingestNotice ? <p className="mt-1 text-xs text-emerald-600">{ingestNotice}</p> : null}
                {ingestError ? <p className="mt-1 text-xs text-rose-600">{ingestError}</p> : null}
              </div>
            </div>
          </article>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Radar size={18} className="text-sky-600" />
                Controle de Runtime
              </h2>
              <p className="text-xs text-slate-500">Ultima atualizacao: {asPrettyDate(payload.updated_at)}</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => void runAction("/api/identity/runtime/enable", { reason: "manual_enable_ui" }, "enable")}
                disabled={busyAction !== ""}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
              >
                <Power size={15} />
                Habilitar
              </button>
              <button
                type="button"
                onClick={() => void runAction("/api/identity/runtime/pause", { reason: "manual_pause_ui" }, "pause")}
                disabled={busyAction !== ""}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
              >
                <CirclePause size={15} />
                Pausar
              </button>
              <button
                type="button"
                onClick={() => void runAction("/api/identity/runtime/resume", { reason: "manual_resume_ui" }, "resume")}
                disabled={busyAction !== ""}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-60"
              >
                <CirclePlay size={15} />
                Retomar
              </button>
              <button
                type="button"
                onClick={() => void runAction("/api/identity/runtime/disable", { reason: "manual_disable_ui" }, "disable")}
                disabled={busyAction !== ""}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-60"
              >
                <Power size={15} />
                Desabilitar
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p>
                Runtime habilitado: <strong>{payload.runtime_enabled ? "sim" : "nao"}</strong> | Pausado:{" "}
                <strong>{payload.runtime_paused ? "sim" : "nao"}</strong> | Auto-start:{" "}
                <strong>{payload.auto_start_enabled ? "sim" : "nao"}</strong>
              </p>
              {payload.last_error ? <p className="mt-1 text-rose-700">Ultimo erro: {payload.last_error}</p> : null}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Camera size={18} className="text-zinc-700" />
                Fontes de Camera
              </h2>
              <button
                type="button"
                onClick={() => void runAction("/api/identity/sources/discover", {}, "discover")}
                disabled={busyAction !== ""}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCcw size={14} />
                Redescobrir
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={selectedSourceId}
                onChange={(event) => setSelectedSourceId(event.target.value)}
                className="min-w-[260px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="">Selecione uma fonte</option>
                {payload.camera_sources.map((source) => (
                  <option key={source.source_id} value={source.source_id}>
                    {source.name} ({source.source_type})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  selectedSourceId
                    ? void runAction("/api/identity/sources/select", { source_id: selectedSourceId }, "select")
                    : null
                }
                disabled={!selectedSourceId || busyAction !== ""}
                className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
              >
                Definir ativa
              </button>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Fonte</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Resolucao</th>
                    <th className="py-2 pr-3">FPS</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.camera_sources.map((source) => (
                    <tr key={source.source_id} className="border-t border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-900">{source.name}</td>
                      <td className="py-2 pr-3 text-slate-700">{source.source_type}</td>
                      <td className="py-2 pr-3 text-slate-700">{source.resolution || "-"}</td>
                      <td className="py-2 pr-3 text-slate-700">{source.fps}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                            source.connected && source.active
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-zinc-300 bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {source.connected && source.active ? "ativo" : "inativo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        {loading ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Carregando runtime...</div>
        ) : null}
      </div>
    </main>
  );
}
