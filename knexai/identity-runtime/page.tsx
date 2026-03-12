"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  CirclePause,
  CirclePlay,
  Database,
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

type IdentityFaceBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
};

type IdentityAnalyzedFace = {
  track_id?: string;
  track_hits?: number;
  confidence?: number;
  face_box?: IdentityFaceBox | null;
  pose?: {
    pose_label?: string;
    pose_match?: boolean;
  } | null;
  quality?: {
    overall_score?: number;
    approved?: boolean;
    reasons?: string[];
  } | null;
};

type IdentityFrameAnalyzeResponse = {
  ok?: boolean;
  face_detected?: boolean;
  confidence?: number;
  expected_view?: string | null;
  face_box?: IdentityFaceBox | null;
  pose?: {
    pose_label?: string;
    pose_match?: boolean;
  } | null;
  quality?: {
    overall_score?: number;
    approved?: boolean;
  } | null;
  faces?: IdentityAnalyzedFace[];
  metadata?: {
    should_capture?: boolean;
    faces_count?: number;
  } | null;
};

type StageOverlayBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
  trackId: string;
};

type StreamAnalyzeSnapshot = {
  confidence: number;
  poseLabel: string;
  poseMatch: boolean;
  qualityScore: number;
  qualityApproved: boolean;
  facesCount: number;
  trackId: string;
};

type BrowserFaceDetectorLike = {
  detect: (input: unknown) => Promise<Array<{ boundingBox?: { x?: number; y?: number; width?: number; height?: number }; score?: number }>>;
};

type MediaPipeFaceDetectorLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number,
  ) => {
    detections?: Array<{
      boundingBox?: { originX?: number; originY?: number; width?: number; height?: number };
      categories?: Array<{ score?: number }>;
    }>;
  };
  close?: () => void;
};

type MediaPipeVisionModule = {
  FilesetResolver: {
    forVisionTasks: (wasmPath: string) => Promise<unknown>;
  };
  FaceDetector: {
    createFromOptions: (
      filesetResolver: unknown,
      options: Record<string, unknown>,
    ) => Promise<MediaPipeFaceDetectorLike>;
  };
};

type InducedReferenceAsset = {
  local_id: string;
  file_name: string;
  mime_type: string;
  data_url: string;
  created_at: string;
};

type WantedReferenceImage = {
  image_key?: string | null;
  capture_view?: string | null;
  quality_score?: number;
  created_at?: string;
  file_name?: string | null;
  public_url?: string | null;
};

type WantedPersonRecord = {
  person_id: string;
  display_name: string;
  profile_kind?: "wanted" | "passive";
  search_active?: boolean;
  preliminary_similarity_threshold?: number;
  strong_similarity_threshold?: number;
  min_consecutive_hits?: number;
  min_window_ms?: number;
  profile?: {
    front_samples?: number;
    left_samples?: number;
    right_samples?: number;
    retention_max_per_view?: number;
    retention_ttl_days?: number;
    consolidated_centroid?: number[] | null;
  } | null;
  profile_vectors_by_view?: Record<string, number[][]>;
  preview_image_key?: string | null;
  preview_image_url?: string | null;
  preview_image_name?: string | null;
  reference_images?: WantedReferenceImage[];
  updated_at?: string;
};

type WantedPeopleResponse = {
  ok?: boolean;
  people?: WantedPersonRecord[];
  message?: string;
};

type PreliminaryGateSnapshot = {
  enabled: boolean;
  source: string;
  similarity: number;
  avgSimilarity: number;
  threshold: number;
  strongThreshold: number;
  consecutiveHits: number;
  minConsecutiveHits: number;
  windowMs: number;
  candidateReady: boolean;
  trackState: string;
  lastUpdatedAt: string;
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
  updated_at: "",
};

const MEDIAPIPE_WASM_LOCAL_PATH = "/vendor/mediapipe/wasm";
const MEDIAPIPE_WASM_CDN_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";
const MEDIAPIPE_FACE_MODEL_LOCAL_PATH = "/vendor/mediapipe/models/blaze_face_short_range.tflite";
const MEDIAPIPE_FACE_MODEL_CDN_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

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

function asFiniteNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function projectFaceBoxToVideo(video: HTMLVideoElement | null, faceBox: IdentityFaceBox | null, trackId = "") {
  if (!video || !faceBox) return null;
  const sourceWidth = asFiniteNumber(video.videoWidth, 0);
  const sourceHeight = asFiniteNumber(video.videoHeight, 0);
  const displayWidth = asFiniteNumber(video.clientWidth, 0);
  const displayHeight = asFiniteNumber(video.clientHeight, 0);
  if (!sourceWidth || !sourceHeight || !displayWidth || !displayHeight) return null;

  const scale = Math.max(displayWidth / sourceWidth, displayHeight / sourceHeight);
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  const offsetX = (displayWidth - renderedWidth) / 2;
  const offsetY = (displayHeight - renderedHeight) / 2;

  const rawLeft = asFiniteNumber(faceBox.x, 0) * scale + offsetX;
  const rawTop = asFiniteNumber(faceBox.y, 0) * scale + offsetY;
  const rawRight = rawLeft + asFiniteNumber(faceBox.w, 0) * scale;
  const rawBottom = rawTop + asFiniteNumber(faceBox.h, 0) * scale;

  const clippedLeft = Math.max(0, Math.min(displayWidth, rawLeft));
  const clippedTop = Math.max(0, Math.min(displayHeight, rawTop));
  const clippedRight = Math.max(0, Math.min(displayWidth, rawRight));
  const clippedBottom = Math.max(0, Math.min(displayHeight, rawBottom));
  const width = clippedRight - clippedLeft;
  const height = clippedBottom - clippedTop;

  if (width < 2 || height < 2) return null;

  return {
    left: clippedLeft,
    top: clippedTop,
    width,
    height,
    confidence: Math.max(0, Math.min(1, asFiniteNumber(faceBox.confidence, 0))),
    trackId: trackId.trim(),
  } satisfies StageOverlayBox;
}

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized;
}

function sanitizeRuntimeText(value: unknown, maxLength: number) {
  const normalized = `${value ?? ""}`.trim().replace(/\s+/g, " ");
  return normalized.slice(0, maxLength);
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
  if (slot === "left") return "Ambiente 2 - Lateral esquerdo";
  if (slot === "front") return "Ambiente 3 - Frontal";
  return "Ambiente 4 - Lateral direito";
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

async function loadMediaPipeVisionModule(): Promise<MediaPipeVisionModule | null> {
  const moduleName = "@mediapipe/tasks-vision";
  try {
    // Avoid compile-time module resolution for optional client runtime dependency.
    // eslint-disable-next-line no-new-func
    const importer = new Function("specifier", "return import(specifier);") as (specifier: string) => Promise<unknown>;
    const loaded = await importer(moduleName);
    return loaded as MediaPipeVisionModule;
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
  const isStreamOnly = isEmbedded && searchParams.get("view") === "stream";
  const [payload, setPayload] = useState<IdentityPanelPayload>(INITIAL_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "streaming">("idle");
  const [cameraError, setCameraError] = useState("");
  const [runtimeApiStatus, setRuntimeApiStatus] = useState<"unknown" | "available" | "missing" | "error">("unknown");
  const [identityFallbackMode, setIdentityFallbackMode] = useState(false);
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
  const [wantedPeople, setWantedPeople] = useState<WantedPersonRecord[]>([]);
  const [wantedLoading, setWantedLoading] = useState(false);
  const [wantedError, setWantedError] = useState("");
  const [wantedNotice, setWantedNotice] = useState("");
  const [wantedDisplayName, setWantedDisplayName] = useState("");
  const [selectedWantedPersonId, setSelectedWantedPersonId] = useState("");
  const [wantedIngestBusy, setWantedIngestBusy] = useState(false);
  const [wantedIngestError, setWantedIngestError] = useState("");
  const [wantedIngestNotice, setWantedIngestNotice] = useState("");
  const [wantedSearchModeEnabled, setWantedSearchModeEnabled] = useState(false);
  const [wantedAutoCycleEnabled, setWantedAutoCycleEnabled] = useState(true);
  const [wantedSearchSessionId, setWantedSearchSessionId] = useState("");
  const [wantedSearchSessionPersonId, setWantedSearchSessionPersonId] = useState("");
  const [pendingImmediateWantedCapture, setPendingImmediateWantedCapture] = useState(false);
  const [referenceCarouselIndex, setReferenceCarouselIndex] = useState(0);
  const [preliminaryGateSnapshot, setPreliminaryGateSnapshot] = useState<PreliminaryGateSnapshot>({
    enabled: false,
    source: "none",
    similarity: 0,
    avgSimilarity: 0,
    threshold: 0.72,
    strongThreshold: 0.82,
    consecutiveHits: 0,
    minConsecutiveHits: 3,
    windowMs: 2400,
    candidateReady: false,
    trackState: "pending",
    lastUpdatedAt: "",
  });
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [autoCaptureBusy, setAutoCaptureBusy] = useState(false);
  const [autoCaptureNotice, setAutoCaptureNotice] = useState("");
  const [autoCaptureError, setAutoCaptureError] = useState("");
  const [autoCaptureLastAt, setAutoCaptureLastAt] = useState("");
  const [faceEmbeddingStatus, setFaceEmbeddingStatus] = useState<"idle" | "ready" | "error">("idle");
  const [streamFaceBoxes, setStreamFaceBoxes] = useState<StageOverlayBox[]>([]);
  const [streamAnalyzeSnapshot, setStreamAnalyzeSnapshot] = useState<StreamAnalyzeSnapshot | null>(null);
  const [streamAnalyzeError, setStreamAnalyzeError] = useState("");
  const [identifiedProfileImage, setIdentifiedProfileImage] = useState<string | null>(null);
  const [embeddingCaptures, setEmbeddingCaptures] = useState<Record<EmbeddingCaptureSlot, EmbeddingCaptureEntry>>({
    left: { image: null, capturedAt: null },
    front: { image: null, capturedAt: null },
    right: { image: null, capturedAt: null },
  });
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const streamAnalyzeInFlightRef = useRef(false);
  const browserFaceDetectorRef = useRef<BrowserFaceDetectorLike | null>(null);
  const browserFaceDetectorCheckedRef = useRef(false);
  const mediaPipeFaceDetectorRef = useRef<MediaPipeFaceDetectorLike | null>(null);
  const mediaPipeFaceDetectorInitRef = useRef<Promise<MediaPipeFaceDetectorLike | null> | null>(null);
  const mediaPipeFaceDetectorUnavailableRef = useRef(false);
  const autoCaptureLastAtRef = useRef(0);
  const autoCaptureSignatureRef = useRef("");
  const referenceEmbeddingCacheRef = useRef<Record<string, number[]>>({});
  const ingestInputRef = useRef<HTMLInputElement | null>(null);
  const inducedInputRef = useRef<HTMLInputElement | null>(null);
  const wantedIngestInputRef = useRef<HTMLInputElement | null>(null);
  const preliminaryGateInFlightRef = useRef(false);
  const preliminaryGateRef = useRef({
    sourceKey: "",
    firstHitAtMs: 0,
    lastHitAtMs: 0,
    consecutiveHits: 0,
    sampleCount: 0,
    avgSimilarity: 0,
  });

  const statusInfo = useMemo(() => statusToken(payload.status), [payload.status]);

  const ensureMediaPipeFaceDetector = useCallback(async () => {
    if (mediaPipeFaceDetectorRef.current) return mediaPipeFaceDetectorRef.current;
    if (mediaPipeFaceDetectorUnavailableRef.current) return null;
    if (!mediaPipeFaceDetectorInitRef.current) {
      mediaPipeFaceDetectorInitRef.current = (async () => {
        try {
          const vision = await loadMediaPipeVisionModule();
          if (!vision) {
            throw new Error("mediapipe_module_unavailable");
          }
          let filesetResolver: unknown;
          try {
            filesetResolver = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_LOCAL_PATH);
          } catch {
            filesetResolver = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_CDN_PATH);
          }

          const modelCandidates = [MEDIAPIPE_FACE_MODEL_LOCAL_PATH, MEDIAPIPE_FACE_MODEL_CDN_PATH];
          for (const modelAssetPath of modelCandidates) {
            try {
              const detector = await vision.FaceDetector.createFromOptions(filesetResolver, {
                baseOptions: { modelAssetPath, delegate: "GPU" },
                runningMode: "VIDEO",
                minDetectionConfidence: 0.45,
              });
              mediaPipeFaceDetectorRef.current = detector;
              return detector;
            } catch {
              try {
                const detector = await vision.FaceDetector.createFromOptions(filesetResolver, {
                  baseOptions: { modelAssetPath },
                  runningMode: "VIDEO",
                  minDetectionConfidence: 0.45,
                });
                mediaPipeFaceDetectorRef.current = detector;
                return detector;
              } catch {
                // Try next model candidate.
              }
            }
          }
          throw new Error("mediapipe_detector_unavailable");
        } catch {
          mediaPipeFaceDetectorUnavailableRef.current = true;
          return null;
        }
      })();
    }
    return mediaPipeFaceDetectorInitRef.current;
  }, []);

  const detectFacesWithBrowserFallback = useCallback(async () => {
    const video = localVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return [] as StageOverlayBox[];

    if (!browserFaceDetectorCheckedRef.current) {
      browserFaceDetectorCheckedRef.current = true;
      try {
        const runtimeWindow = window as unknown as {
          FaceDetector?: new (options?: Record<string, unknown>) => BrowserFaceDetectorLike;
        };
        const DetectorCtor = runtimeWindow.FaceDetector;
        if (DetectorCtor) {
          browserFaceDetectorRef.current = new DetectorCtor({
            fastMode: true,
            maxDetectedFaces: 8,
          });
        }
      } catch {
        browserFaceDetectorRef.current = null;
      }
    }

    const detector = browserFaceDetectorRef.current;
    if (detector) {
      try {
        const detections = await detector.detect(video);
        const browserOverlays = (Array.isArray(detections) ? detections : [])
          .map((item, index) => {
            const box = item?.boundingBox;
            if (!box) return null;
            return projectFaceBoxToVideo(
              video,
              {
                x: asFiniteNumber(box.x, 0),
                y: asFiniteNumber(box.y, 0),
                w: asFiniteNumber(box.width, 0),
                h: asFiniteNumber(box.height, 0),
                confidence: Math.max(0.35, Math.min(0.9, asFiniteNumber(item?.score, 0.55))),
              },
              `local-${index + 1}`,
            );
          })
          .filter((item): item is StageOverlayBox => Boolean(item))
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 6);
        if (browserOverlays.length > 0) {
          return browserOverlays;
        }
      } catch {
        // Continue to MediaPipe fallback when browser FaceDetector is unstable.
      }
    }

    const mediaPipeDetector = await ensureMediaPipeFaceDetector();
    if (!mediaPipeDetector) return [] as StageOverlayBox[];

    try {
      const result = mediaPipeDetector.detectForVideo(video, performance.now());
      const overlays = (Array.isArray(result?.detections) ? result.detections : [])
        .map((item, index) => {
          const box = item?.boundingBox;
          if (!box) return null;
          return projectFaceBoxToVideo(
            video,
            {
              x: asFiniteNumber(box.originX, 0),
              y: asFiniteNumber(box.originY, 0),
              w: asFiniteNumber(box.width, 0),
              h: asFiniteNumber(box.height, 0),
              confidence: Math.max(0.35, Math.min(0.95, asFiniteNumber(item?.categories?.[0]?.score, 0.58))),
            },
            `local-${index + 1}`,
          );
        })
        .filter((item): item is StageOverlayBox => Boolean(item))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 6);
      return overlays;
    } catch {
      return [] as StageOverlayBox[];
    }
  }, [ensureMediaPipeFaceDetector]);

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
          const isFallback = response.headers.get("x-identity-fallback") === "1";
          setIdentityFallbackMode(isFallback);
          if (isFallback) {
            setRuntimeNotice(
              "Runtime em fallback local: backend ANM indisponivel. O overlay pode operar em detector local, mas a analise oficial /frame/analyze depende do backend.",
            );
          } else {
            setRuntimeNotice("");
          }
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
          setIdentityFallbackMode(true);
          setRuntimeNotice("Servico de runtime nao encontrado (404). O palco local continua funcional para captura.");
          setError("");
          return;
        }
        throw new Error(lastFailure || "IDENTITY_PANEL_HTTP_404");
      }
      setRuntimeApiStatus("available");
      setPayload(data);
      setSelectedSourceId((current) => current || String(data.selected_source_id || ""));
      setError("");
    } catch (err) {
      setRuntimeApiStatus("error");
      setIdentityFallbackMode(true);
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

  const fetchWantedPeople = useCallback(
    async (options?: { preserveSelection?: boolean }) => {
      setWantedLoading(true);
      try {
        const response = await fetch("/api/identity/wanted?profile_kind=wanted&limit=120", { cache: "no-store" });
        const body = (await response.json().catch(() => ({}))) as WantedPeopleResponse;
        if (!response.ok) {
          throw new Error(body.message || `WANTED_QUERY_HTTP_${response.status}`);
        }
        const people = Array.isArray(body.people) ? body.people : [];
        setWantedPeople(people);
        setWantedError("");
        setSelectedWantedPersonId((current) => {
          if (options?.preserveSelection && current && people.some((item) => item.person_id === current)) {
            return current;
          }
          if (current && people.some((item) => item.person_id === current)) return current;
          return people[0]?.person_id || "";
        });
      } catch (err) {
        setWantedError(err instanceof Error ? err.message : "Falha ao carregar banco de pessoas procuradas.");
      } finally {
        setWantedLoading(false);
      }
    },
    [],
  );

  const stopWantedSearchSession = useCallback(async () => {
    if (!wantedSearchSessionId) return;
    try {
      await fetch("/api/identity/recognition/search/stop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: wantedSearchSessionId }),
        cache: "no-store",
      }).catch(() => null);
    } finally {
      setWantedSearchSessionId("");
      setWantedSearchSessionPersonId("");
    }
  }, [wantedSearchSessionId]);

  const startWantedSearchSession = useCallback(
    async (person: WantedPersonRecord | null) => {
      if (!person || !wantedSearchModeEnabled) return;
      if (runtimeApiStatus !== "available") return;
      const vectors = person.profile_vectors_by_view || {};
      if (!Object.keys(vectors).length) return;
      const response = await fetch("/api/identity/recognition/search/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target_person_id: person.person_id,
          threshold: Math.max(0, Math.min(1, Number(person.strong_similarity_threshold || 0.82))),
          vectors_by_view: vectors,
          metadata: {
            source: "identity_runtime_ui_wanted_registry_v1",
          },
        }),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as { session_id?: string; message?: string };
      if (!response.ok) {
        throw new Error(body.message || `WANTED_SEARCH_START_HTTP_${response.status}`);
      }
      const sessionId = asNonEmptyString(body.session_id || "");
      if (sessionId) {
        setWantedSearchSessionId(sessionId);
        setWantedSearchSessionPersonId(person.person_id);
      }
    },
    [runtimeApiStatus, wantedSearchModeEnabled],
  );

  const stageTiles = useMemo<StageCameraTile[]>(() => {
    return [
      { id: "channel-1", name: "Ambiente 1", sourceType: "diagnostic", connected: cameraState === "streaming", isPlaceholder: false },
      { id: "channel-2", name: "Ambiente 2", sourceType: "left-profile", connected: cameraState === "streaming", isPlaceholder: false },
      { id: "channel-3", name: "Ambiente 3", sourceType: "frontal-profile", connected: cameraState === "streaming", isPlaceholder: false },
      { id: "channel-4", name: "Ambiente 4", sourceType: "right-profile", connected: cameraState === "streaming", isPlaceholder: false },
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
  const selectedWantedPerson = useMemo(() => {
    if (!wantedPeople.length) return null;
    if (selectedWantedPersonId) {
      const found = wantedPeople.find((item) => item.person_id === selectedWantedPersonId);
      if (found) return found;
    }
    return wantedPeople[0];
  }, [selectedWantedPersonId, wantedPeople]);
  const selectedWantedReferenceImage = useMemo(() => {
    const person = selectedWantedPerson;
    if (!person) return null;
    const images = Array.isArray(person.reference_images) ? person.reference_images.filter((item) => item?.public_url) : [];
    if (!images.length) {
      if (person.preview_image_url) {
        return {
          image_key: person.preview_image_key || null,
          public_url: person.preview_image_url,
          file_name: person.preview_image_name || person.display_name,
          capture_view: "unknown",
          quality_score: 0,
          created_at: person.updated_at || "",
        } as WantedReferenceImage;
      }
      return null;
    }
    const safeIndex = referenceCarouselIndex % images.length;
    return images[safeIndex] || images[0];
  }, [referenceCarouselIndex, selectedWantedPerson]);
  const selectedWantedPhoto = useMemo(() => {
    return selectedWantedReferenceImage?.public_url || selectedWantedPerson?.preview_image_url || null;
  }, [selectedWantedPerson?.preview_image_url, selectedWantedReferenceImage?.public_url]);

  const selectedEntityPhoto =
    selectedEntityPhotoFromSqlRegistry || selectedEntityPhotoFromEntityPayload || selectedWantedPhoto || selectedEntityPhotoFromStage || null;
  const selectedEntityPhotoOrigin = selectedEntityPhotoFromSqlRegistry
    ? "banco (sql/imagens)"
    : selectedEntityPhotoFromEntityPayload
      ? `banco (${pickEntityImageOrigin(selectedEntity) || "sql/imagens"})`
    : selectedWantedPhoto
      ? `banco (pessoas procuradas: ${selectedWantedPerson?.display_name || "-"})`
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
      setCameraError("Nao foi possivel capturar imagem do Ambiente 1.");
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

  const openWantedIngestPicker = useCallback(() => {
    wantedIngestInputRef.current?.click();
  }, []);

  const handleWantedIngestUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []).filter((item) => item.type.startsWith("image/"));
      event.target.value = "";
      if (!files.length) return;

      const preferredPersonId = sanitizeRuntimeText(selectedWantedPersonId || "", 120);
      const preferredDisplayName =
        sanitizeRuntimeText(wantedDisplayName, 220) ||
        sanitizeRuntimeText(selectedWantedPerson?.display_name || "", 220) ||
        sanitizeRuntimeText(files[0]?.name?.replace(/\.[^.]+$/, "") || "", 220) ||
        "Pessoa Procurada";

      setWantedIngestBusy(true);
      setWantedIngestError("");
      setWantedIngestNotice("");
      setWantedNotice("");
      try {
        const formData = new FormData();
        for (const file of files.slice(0, 24)) {
          formData.append("files", file);
        }
        if (preferredPersonId) formData.append("person_id", preferredPersonId);
        formData.append("display_name", preferredDisplayName);
        formData.append("profile_kind", "wanted");
        formData.append("search_active", "true");
        formData.append("source_key", entityStageSourceId || "channel-1");
        formData.append("retention_max_per_view", "12");
        formData.append("retention_ttl_days", "180");

        const response = await fetch("/api/identity/wanted", {
          method: "POST",
          body: formData,
          cache: "no-store",
        });
        const body = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          message?: string;
          person_id?: string;
          ingested_images?: number;
          embeddings_ready?: number;
        };
        if (!response.ok) {
          throw new Error(body.message || `WANTED_INGEST_HTTP_${response.status}`);
        }

        const personId = asNonEmptyString(body.person_id || "");
        if (personId) {
          setSelectedWantedPersonId(personId);
        }
        setWantedDisplayName("");
        setWantedSearchModeEnabled(true);
        setWantedAutoCycleEnabled(true);
        setPendingImmediateWantedCapture(true);
        setWantedIngestNotice(
          `Banco de procura atualizado: ${Number(body.ingested_images || 0)} imagem(ns), ${Number(body.embeddings_ready || 0)} embedding(s).`,
        );
        setWantedNotice("Fluxo imediato armado: captura automatica vai iniciar no proximo ciclo.");
        await fetchWantedPeople({ preserveSelection: true });
      } catch (err) {
        setWantedIngestError(err instanceof Error ? err.message : "Falha ao ingerir imagens no banco de pessoas procuradas.");
      } finally {
        setWantedIngestBusy(false);
      }
    },
    [
      entityStageSourceId,
      fetchWantedPeople,
      selectedWantedPerson?.display_name,
      selectedWantedPersonId,
      wantedDisplayName,
    ],
  );

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

    if (wantedSearchModeEnabled && selectedWantedPerson) {
      const wantedCentroid = Array.isArray(selectedWantedPerson.profile?.consolidated_centroid)
        ? selectedWantedPerson.profile?.consolidated_centroid
            ?.map((item) => Number(item || 0))
            .filter((item) => Number.isFinite(item))
        : [];
      const wantedImageKey = asNonEmptyString(selectedWantedReferenceImage?.image_key || "") || null;
      const wantedPersonKey = asNonEmptyString(selectedWantedPerson.person_id) || "wanted";
      const centroidCacheKey = `wanted-centroid:${wantedPersonKey}`;
      if (wantedCentroid.length > 0) {
        referenceEmbeddingCacheRef.current[centroidCacheKey] = wantedCentroid;
        return {
          embedding: wantedCentroid,
          candidateImageKey: wantedImageKey,
          referenceId: centroidCacheKey,
        };
      }

      const wantedUrl = asNonEmptyString(selectedWantedReferenceImage?.public_url || selectedWantedPerson.preview_image_url || "");
      if (wantedUrl) {
        const wantedCacheKey = `wanted-image:${wantedPersonKey}:${wantedImageKey || "preview"}`;
        const cached = referenceEmbeddingCacheRef.current[wantedCacheKey];
        if (Array.isArray(cached) && cached.length > 0) {
          return { embedding: cached, candidateImageKey: wantedImageKey, referenceId: wantedCacheKey };
        }
        const referenceDataUrl = await fetchImageUrlAsDataUrl(wantedUrl);
        if (referenceDataUrl) {
          const embedding = await requestFaceEmbedding(referenceDataUrl);
          referenceEmbeddingCacheRef.current[wantedCacheKey] = embedding;
          return { embedding, candidateImageKey: wantedImageKey, referenceId: wantedCacheKey };
        }
      }
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
  }, [
    dbReferenceAsset,
    hasInducedReference,
    inducedReferenceAsset,
    requestFaceEmbedding,
    selectedWantedPerson,
    selectedWantedReferenceImage?.image_key,
    selectedWantedReferenceImage?.public_url,
    wantedSearchModeEnabled,
  ]);

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
              layer_name: params.triggerReason.includes("induced") ? "induced_reference_gate" : "diagnostic_environment_gate",
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

  const validateAutoCaptureEnvironment = useCallback(
    async (params: { frameDataUrl: string; sourceKey: string; captureView: string; slot: EmbeddingCaptureSlot }) => {
      try {
        const response = await fetch("/api/identity/frame/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source_id: params.sourceKey,
            frame_data_url: params.frameDataUrl,
            expected_view: params.captureView,
            min_quality_score: 0.5,
            require_pose_match: true,
            emit_observation: false,
            max_faces: 4,
            stability_track_key: `autocapture-gate:${params.sourceKey}:${params.slot}`,
            metadata: {
              source: "identity_runtime_ui_autocapture_gate_v2",
              validation_environment: params.captureView,
            },
          }),
          cache: "no-store",
        });
        const fallbackMode = response.headers.get("x-identity-fallback") === "1";
        if (fallbackMode) {
          const localFaces = await detectFacesWithBrowserFallback();
          const lead = localFaces[0] || null;
          return {
            approved: Boolean(localFaces.length > 0),
            reason: localFaces.length > 0 ? "" : "local_detector_no_face",
            confidence: asFiniteNumber(lead?.confidence, 0),
            trackId: lead?.trackId || "",
          };
        }
        const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok) {
          const detail = asNonEmptyString(raw.detail) || asNonEmptyString(raw.message) || `FRAME_ANALYZE_HTTP_${response.status}`;
          return { approved: false, reason: detail, confidence: 0, trackId: "" };
        }

        const body = raw as IdentityFrameAnalyzeResponse;
        const faces = Array.isArray(body.faces) ? body.faces : [];
        const approvedFace = faces.find((face) => Boolean(face?.quality?.approved) && Boolean(face?.pose?.pose_match));
        if (approvedFace?.face_box) {
          return {
            approved: true,
            reason: "",
            confidence: Math.max(0, Math.min(1, asFiniteNumber(approvedFace.confidence, approvedFace.face_box.confidence))),
            trackId: asNonEmptyString(approvedFace.track_id) || "",
          };
        }

        const fallbackApproved = Boolean(body.quality?.approved) && Boolean(body.pose?.pose_match);
        return {
          approved: fallbackApproved,
          reason: fallbackApproved ? "" : "pose_ou_qualidade_reprovada",
          confidence: Math.max(0, Math.min(1, asFiniteNumber(body.confidence, 0))),
          trackId: "",
        };
      } catch (err) {
        const localFaces = await detectFacesWithBrowserFallback();
        const lead = localFaces[0] || null;
        if (localFaces.length > 0) {
          return {
            approved: true,
            reason: "",
            confidence: asFiniteNumber(lead?.confidence, 0),
            trackId: lead?.trackId || "",
          };
        }
        return {
          approved: false,
          reason: err instanceof Error ? err.message : "FRAME_ANALYZE_ERROR",
          confidence: 0,
          trackId: "",
        };
      }
    },
    [detectFacesWithBrowserFallback],
  );

  const layeredMatchState = useMemo(() => {
    const someoneInFrame = Boolean(payload.awareness_state.someone_in_frame) || (cameraState === "streaming" && inducedSearchActive);
    const confidenceValue = Number(selectedEntity?.confidence || 0);
    const confidenceGate = Boolean(payload.awareness_state.identity_confirmed) || confidenceValue >= 0.68 || inducedSearchActive;
    const referenceGate = Boolean(
      hasInducedReference ||
        dbReferenceAsset?.image_key ||
        (wantedSearchModeEnabled && (selectedWantedPerson?.preview_image_url || selectedWantedPerson?.profile?.consolidated_centroid?.length)),
    );
    const diagnosticEnvironmentGate =
      inducedSearchActive || String(payload.awareness_state.visual_source || "") === "channel-1" || entityStageSourceId === "channel-1";
    const preliminaryGate = preliminaryGateSnapshot.candidateReady || pendingImmediateWantedCapture;
    const pass =
      (pendingImmediateWantedCapture && cameraState === "streaming" && referenceGate) ||
      (someoneInFrame && confidenceGate && referenceGate && diagnosticEnvironmentGate && preliminaryGate);
    return {
      pass,
      preliminaryGate,
      triggerReason: pendingImmediateWantedCapture
        ? "wanted_immediate_capture"
        : inducedSearchActive
          ? "induced_reference_match"
          : "diagnostic_environment_match",
      confidenceValue,
    };
  }, [
    cameraState,
    dbReferenceAsset?.image_key,
    entityStageSourceId,
    hasInducedReference,
    inducedSearchActive,
    pendingImmediateWantedCapture,
    preliminaryGateSnapshot.candidateReady,
    payload.awareness_state.identity_confirmed,
    payload.awareness_state.someone_in_frame,
    payload.awareness_state.visual_source,
    selectedWantedPerson?.preview_image_url,
    selectedWantedPerson?.profile?.consolidated_centroid?.length,
    selectedEntity?.confidence,
    wantedSearchModeEnabled,
  ]);

  const runAutonomousMultiCapture = useCallback(
    async (triggerReason: string) => {
      if (autoCaptureBusy) return;
      if (cameraState !== "streaming") return;

      if (triggerReason === "wanted_immediate_capture" && pendingImmediateWantedCapture) {
        setPendingImmediateWantedCapture(false);
      }
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
      let skippedByGate = 0;
      const gateFailures: string[] = [];
      for (const item of captureSlots) {
        const frame = derivePointFrameFromVideo(localVideoRef.current, item.slot) || captureFrameFromVideo(localVideoRef.current);
        if (!frame) continue;

        const gate = await validateAutoCaptureEnvironment({
          frameDataUrl: frame,
          sourceKey: item.sourceKey,
          captureView: item.captureView,
          slot: item.slot,
        });
        if (!gate.approved) {
          skippedByGate += 1;
          if (gate.reason) {
            gateFailures.push(`${item.captureView}:${gate.reason}`);
          }
          continue;
        }

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
            `Autocaptura concluida: ${processed}/3 ambientes processados, ${uploadedCount} captura(s) no SQL e ${registeredCount} registro(s) em camadas (${triggerReason}).`,
          );
        } else {
          setAutoCaptureNotice(
            `Autocaptura concluida: ${processed}/3 ambientes processados com referencia local induzida (${resolvedReference.referenceId}).`,
          );
        }
      } else {
        const gateInfo = gateFailures.length ? ` (${gateFailures.slice(0, 3).join(" | ")})` : "";
        setAutoCaptureError(`Autocaptura nao gerou capturas validas nos ambientes 2/3/4${gateInfo}.`);
      }
      if (skippedByGate > 0 && processed > 0) {
        setAutoCaptureNotice((current) => `${current} ${skippedByGate} ambiente(s) reprovado(s) no gate.`);
      }
      setAutoCaptureBusy(false);
    },
    [
      autoCaptureBusy,
      cameraState,
      pendingImmediateWantedCapture,
      registerRecognitionEvent,
      requestFaceEmbedding,
      resolveActiveReferenceEmbedding,
      selectedEntity?.entity_id,
      uploadCapturedFrameToSql,
      validateAutoCaptureEnvironment,
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
    if (cameraState !== "streaming") {
      setStreamFaceBoxes([]);
      setStreamAnalyzeSnapshot(null);
      setStreamAnalyzeError("");
      streamAnalyzeInFlightRef.current = false;
      return;
    }

    let cancelled = false;

    const runFrameAnalyze = async () => {
      if (cancelled || streamAnalyzeInFlightRef.current) return;
      const frameDataUrl = captureFrameFromVideo(localVideoRef.current);
      if (!frameDataUrl) return;

      streamAnalyzeInFlightRef.current = true;
      try {
        if (identityFallbackMode) {
          const fallbackOverlays = await detectFacesWithBrowserFallback();
          if (cancelled) return;
          setStreamFaceBoxes(fallbackOverlays);
          if (fallbackOverlays.length > 0) {
            const lead = fallbackOverlays[0];
            setStreamAnalyzeSnapshot({
              confidence: lead.confidence,
              poseLabel: "local",
              poseMatch: true,
              qualityScore: lead.confidence,
              qualityApproved: true,
              facesCount: fallbackOverlays.length,
              trackId: lead.trackId || "",
            });
            setStreamAnalyzeError("");
          } else {
            setStreamAnalyzeSnapshot(null);
            setStreamAnalyzeError("DETECTOR_LOCAL_INDISPONIVEL: sem suporte no navegador para detecao facial local.");
          }
          return;
        }

        const response = await fetch("/api/identity/frame/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source_id: primarySourceId,
            frame_data_url: frameDataUrl,
            expected_view: "front",
            min_quality_score: 0.5,
            require_pose_match: false,
            emit_observation: false,
            max_faces: 4,
            entity_id: selectedEntity?.entity_id || "",
            label: selectedEntity?.label || "",
            nominal_name: selectedEntity?.nominal_name || "",
            stability_track_key: `stream-overlay:${primarySourceId}`,
            metadata: { source: "identity_runtime_ui_stream_overlay_v1" },
          }),
          cache: "no-store",
        });
        const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok) {
          const detail = asNonEmptyString(raw.detail) || asNonEmptyString(raw.message) || `FRAME_ANALYZE_HTTP_${response.status}`;
          throw new Error(detail);
        }

        const body = raw as IdentityFrameAnalyzeResponse;
        const analyzedFaces = (Array.isArray(body.faces) ? body.faces : [])
          .filter((face): face is IdentityAnalyzedFace => Boolean(face?.face_box))
          .sort((a, b) => asFiniteNumber(b.confidence, 0) - asFiniteNumber(a.confidence, 0));
        const backendOverlays = analyzedFaces
          .map((face, index) =>
            projectFaceBoxToVideo(
              localVideoRef.current,
              face.face_box || null,
              asNonEmptyString(face.track_id) || `track-${index + 1}`,
            ),
          )
          .filter((item): item is StageOverlayBox => Boolean(item));
        if (!backendOverlays.length && body.face_detected && body.face_box) {
          const singleOverlay = projectFaceBoxToVideo(localVideoRef.current, body.face_box, "track-1");
          if (singleOverlay) {
            backendOverlays.push(singleOverlay);
          }
        }
        const overlays = backendOverlays.length > 0 ? backendOverlays : await detectFacesWithBrowserFallback();
        setStreamFaceBoxes(overlays);

        const leadFace = analyzedFaces[0] || null;
        const leadOverlay = overlays[0] || null;
        if (!leadFace && !body.face_box && !leadOverlay) {
          setStreamAnalyzeSnapshot(null);
        } else {
          setStreamAnalyzeSnapshot({
            confidence: Math.max(
              0,
              Math.min(
                1,
                asFiniteNumber(
                  leadFace?.confidence,
                  asFiniteNumber(body.confidence, asFiniteNumber(leadOverlay?.confidence, 0)),
                ),
              ),
            ),
            poseLabel: asNonEmptyString(leadFace?.pose?.pose_label) || asNonEmptyString(body.pose?.pose_label) || "-",
            poseMatch: Boolean(leadFace?.pose?.pose_match ?? body.pose?.pose_match),
            qualityScore: Math.max(
              0,
              Math.min(
                1,
                asFiniteNumber(
                  leadFace?.quality?.overall_score,
                  asFiniteNumber(body.quality?.overall_score, asFiniteNumber(leadOverlay?.confidence, 0)),
                ),
              ),
            ),
            qualityApproved: Boolean(leadFace?.quality?.approved ?? body.quality?.approved),
            facesCount: Math.max(overlays.length, asFiniteNumber(body.metadata?.faces_count, 0)),
            trackId: asNonEmptyString(leadFace?.track_id) || leadOverlay?.trackId || "",
          });
        }
        setStreamAnalyzeError("");
      } catch (err) {
        if (cancelled) return;
        const fallbackOverlays = await detectFacesWithBrowserFallback();
        setStreamFaceBoxes(fallbackOverlays);
        if (fallbackOverlays.length > 0) {
          const lead = fallbackOverlays[0];
          setStreamAnalyzeSnapshot({
            confidence: lead.confidence,
            poseLabel: "local",
            poseMatch: true,
            qualityScore: lead.confidence,
            qualityApproved: true,
            facesCount: fallbackOverlays.length,
            trackId: lead.trackId || "",
          });
        } else {
          setStreamAnalyzeSnapshot(null);
        }
        const detail = err instanceof Error ? err.message : "FRAME_ANALYZE_ERROR";
        const message = fallbackOverlays.length > 0
          ? `ANALISE_BACKEND_INDISPONIVEL: ${detail} | usando detector local`
          : `ANALISE_INDISPONIVEL: ${detail}`;
        setStreamAnalyzeError((current) => (current === message ? current : message));
      } finally {
        streamAnalyzeInFlightRef.current = false;
      }
    };

    void runFrameAnalyze();
    const timer = window.setInterval(() => {
      void runFrameAnalyze();
    }, 650);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      streamAnalyzeInFlightRef.current = false;
    };
  }, [
    cameraState,
    detectFacesWithBrowserFallback,
    identityFallbackMode,
    primarySourceId,
    selectedEntity?.entity_id,
    selectedEntity?.label,
    selectedEntity?.nominal_name,
  ]);

  useEffect(() => {
    void fetchWantedPeople({ preserveSelection: true });
    const timer = window.setInterval(() => {
      void fetchWantedPeople({ preserveSelection: true });
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [fetchWantedPeople]);

  useEffect(() => {
    if (!wantedPeople.length) {
      if (selectedWantedPersonId) setSelectedWantedPersonId("");
      return;
    }
    if (selectedWantedPersonId && wantedPeople.some((item) => item.person_id === selectedWantedPersonId)) return;
    setSelectedWantedPersonId(wantedPeople[0].person_id);
  }, [selectedWantedPersonId, wantedPeople]);

  useEffect(() => {
    setReferenceCarouselIndex(0);
  }, [selectedWantedPersonId]);

  useEffect(() => {
    if (!wantedSearchModeEnabled) return;
    if (!wantedAutoCycleEnabled) return;
    const confirmedByRuntime = Boolean(payload.awareness_state.identity_confirmed);
    const strongThreshold = Math.max(0, Math.min(1, Number(selectedWantedPerson?.strong_similarity_threshold || 0.82)));
    const confirmedByConfidence = Number(selectedEntity?.confidence || 0) >= strongThreshold;
    if (confirmedByRuntime || confirmedByConfidence) return;
    const person = selectedWantedPerson;
    if (!person) return;
    const images = Array.isArray(person.reference_images) ? person.reference_images.filter((item) => item?.public_url) : [];
    const timer = window.setInterval(() => {
      if (images.length > 1) {
        setReferenceCarouselIndex((current) => (current + 1) % images.length);
        return;
      }
      if (wantedPeople.length > 1) {
        setSelectedWantedPersonId((current) => {
          const index = wantedPeople.findIndex((item) => item.person_id === current);
          const next = index >= 0 ? (index + 1) % wantedPeople.length : 0;
          return wantedPeople[next]?.person_id || current;
        });
      }
    }, 1800);
    return () => window.clearInterval(timer);
  }, [
    payload.awareness_state.identity_confirmed,
    selectedEntity?.confidence,
    selectedWantedPerson,
    selectedWantedPerson?.strong_similarity_threshold,
    wantedPeople,
    wantedAutoCycleEnabled,
    wantedSearchModeEnabled,
  ]);

  useEffect(() => {
    if (!wantedSearchModeEnabled || !selectedWantedPerson) {
      if (wantedSearchSessionId) {
        void stopWantedSearchSession();
      }
      return;
    }
    if (runtimeApiStatus !== "available") return;
    if (wantedSearchSessionId && wantedSearchSessionPersonId === selectedWantedPerson.person_id) {
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        if (wantedSearchSessionId) {
          await stopWantedSearchSession();
        }
        if (cancelled) return;
        await startWantedSearchSession(selectedWantedPerson);
      } catch (err) {
        if (cancelled) return;
        setWantedError(err instanceof Error ? err.message : "Falha ao iniciar busca ativa no backend.");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    runtimeApiStatus,
    selectedWantedPerson,
    startWantedSearchSession,
    stopWantedSearchSession,
    wantedSearchModeEnabled,
    wantedSearchSessionId,
    wantedSearchSessionPersonId,
  ]);

  useEffect(() => {
    return () => {
      if (wantedSearchSessionId) {
        void fetch("/api/identity/recognition/search/stop", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session_id: wantedSearchSessionId }),
          cache: "no-store",
        }).catch(() => null);
      }
    };
  }, [wantedSearchSessionId]);

  useEffect(() => {
    if (cameraState !== "streaming") {
      preliminaryGateRef.current = {
        sourceKey: "",
        firstHitAtMs: 0,
        lastHitAtMs: 0,
        consecutiveHits: 0,
        sampleCount: 0,
        avgSimilarity: 0,
      };
      setPreliminaryGateSnapshot((current) => ({
        ...current,
        enabled: false,
        source: "none",
        candidateReady: false,
        consecutiveHits: 0,
        similarity: 0,
        avgSimilarity: 0,
        trackState: "pending",
        lastUpdatedAt: new Date().toISOString(),
      }));
      return;
    }

    if (pendingImmediateWantedCapture) {
      setPreliminaryGateSnapshot((current) => ({
        ...current,
        enabled: true,
        source: "wanted-immediate",
        candidateReady: true,
        trackState: "immediate_capture",
        lastUpdatedAt: new Date().toISOString(),
      }));
      return;
    }

    let cancelled = false;
    const runPreGate = async () => {
      if (cancelled || preliminaryGateInFlightRef.current) return;
      preliminaryGateInFlightRef.current = true;
      try {
        const reference = await resolveActiveReferenceEmbedding();
        if (!reference?.embedding?.length) {
          setPreliminaryGateSnapshot((current) => ({
            ...current,
            enabled: false,
            source: "no_reference",
            candidateReady: false,
            trackState: "no_reference",
            lastUpdatedAt: new Date().toISOString(),
          }));
          return;
        }

        const frame = captureFrameFromVideo(localVideoRef.current);
        if (!frame) return;
        const probeEmbedding = await requestFaceEmbedding(frame);
        const similarity = cosineSimilarity(reference.embedding, probeEmbedding);

        const threshold = Math.max(0, Math.min(1, Number(selectedWantedPerson?.preliminary_similarity_threshold || 0.72)));
        const strongThreshold = Math.max(0, Math.min(1, Number(selectedWantedPerson?.strong_similarity_threshold || 0.82)));
        const minHits = Math.max(1, Number(selectedWantedPerson?.min_consecutive_hits || 3));
        const windowMs = Math.max(600, Number(selectedWantedPerson?.min_window_ms || 2400));
        const now = Date.now();

        const tracker = preliminaryGateRef.current;
        if (tracker.sourceKey !== reference.referenceId || now - tracker.lastHitAtMs > windowMs * 2) {
          tracker.sourceKey = reference.referenceId;
          tracker.firstHitAtMs = 0;
          tracker.lastHitAtMs = 0;
          tracker.consecutiveHits = 0;
          tracker.sampleCount = 0;
          tracker.avgSimilarity = 0;
        }

        tracker.sampleCount += 1;
        tracker.avgSimilarity = ((tracker.avgSimilarity * (tracker.sampleCount - 1)) + similarity) / Math.max(1, tracker.sampleCount);

        if (similarity >= threshold) {
          if (!tracker.firstHitAtMs || now - tracker.firstHitAtMs > windowMs) {
            tracker.firstHitAtMs = now;
            tracker.consecutiveHits = 1;
          } else {
            tracker.consecutiveHits += 1;
          }
          tracker.lastHitAtMs = now;
        } else if (!tracker.lastHitAtMs || now - tracker.lastHitAtMs > Math.max(800, windowMs / 2)) {
          tracker.firstHitAtMs = 0;
          tracker.consecutiveHits = 0;
        }

        const candidateReady =
          tracker.consecutiveHits >= minHits && tracker.firstHitAtMs > 0 && now - tracker.firstHitAtMs <= windowMs;
        const trackState = candidateReady
          ? similarity >= strongThreshold
            ? "candidate_strong"
            : "candidate_pending_strong"
          : "preliminary_pending";

        setPreliminaryGateSnapshot({
          enabled: true,
          source: reference.referenceId,
          similarity,
          avgSimilarity: tracker.avgSimilarity,
          threshold,
          strongThreshold,
          consecutiveHits: tracker.consecutiveHits,
          minConsecutiveHits: minHits,
          windowMs,
          candidateReady,
          trackState,
          lastUpdatedAt: new Date().toISOString(),
        });
      } catch (err) {
        if (cancelled) return;
        setPreliminaryGateSnapshot((current) => ({
          ...current,
          enabled: true,
          candidateReady: false,
          source: "pre_gate_error",
          trackState: err instanceof Error ? err.message : "pre_gate_error",
          lastUpdatedAt: new Date().toISOString(),
        }));
      } finally {
        preliminaryGateInFlightRef.current = false;
      }
    };

    void runPreGate();
    const timer = window.setInterval(() => {
      void runPreGate();
    }, 1300);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    cameraState,
    pendingImmediateWantedCapture,
    requestFaceEmbedding,
    resolveActiveReferenceEmbedding,
    selectedWantedPerson?.min_consecutive_hits,
    selectedWantedPerson?.min_window_ms,
    selectedWantedPerson?.preliminary_similarity_threshold,
    selectedWantedPerson?.strong_similarity_threshold,
  ]);

  useEffect(() => {
    if (!pendingImmediateWantedCapture) return;
    if (cameraState === "streaming" || cameraState === "starting") return;
    void startCameraPreview();
  }, [cameraState, pendingImmediateWantedCapture, startCameraPreview]);

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
    if (pendingImmediateWantedCapture) {
      autoCaptureLastAtRef.current = now;
      autoCaptureSignatureRef.current = `wanted-immediate:${selectedWantedPersonId || "none"}:${now}`;
      void runAutonomousMultiCapture(layeredMatchState.triggerReason);
      return;
    }
    const cooldownMs = 12_000;
    const referenceSignature = hasInducedReference
      ? `induced:${inducedReferenceAsset?.local_id || "none"}`
      : wantedSearchModeEnabled
        ? `wanted:${selectedWantedPerson?.person_id || "none"}:${selectedWantedReferenceImage?.image_key || "preview"}`
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
    pendingImmediateWantedCapture,
    layeredMatchState.pass,
    layeredMatchState.triggerReason,
    runAutonomousMultiCapture,
    selectedEntity?.entity_id,
    selectedWantedPerson?.person_id,
    selectedWantedReferenceImage?.image_key,
    selectedWantedPersonId,
    wantedSearchModeEnabled,
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

  useEffect(
    () => () => {
      try {
        mediaPipeFaceDetectorRef.current?.close?.();
      } catch {
        // Ignore detector shutdown errors.
      }
      mediaPipeFaceDetectorRef.current = null;
      mediaPipeFaceDetectorInitRef.current = null;
      mediaPipeFaceDetectorUnavailableRef.current = false;
    },
    [],
  );

  return (
    <main
      className={`min-h-screen bg-[#05070d] text-slate-100 ${
        isStreamOnly ? "h-full min-h-0 overflow-hidden p-0" : isEmbedded ? "h-full min-h-full p-2 sm:p-3" : "px-4 py-4 md:px-6"
      } [&_.bg-white]:!bg-[#0f172a] [&_.bg-white\\/95]:!bg-[#0f172a] [&_.bg-slate-50]:!bg-[#101d33] [&_.bg-slate-100]:!bg-[#17243b] [&_.border-slate-300]:!border-[#314464] [&_.border-slate-200]:!border-[#24324b] [&_.border-slate-100]:!border-[#1a2740] [&_.text-slate-900]:!text-slate-100 [&_.text-slate-800]:!text-slate-200 [&_.text-slate-700]:!text-slate-300 [&_.text-slate-600]:!text-slate-400 [&_.text-slate-500]:!text-slate-500 [&_.text-zinc-700]:!text-slate-300 [&_.text-zinc-800]:!text-slate-200 [&_.text-zinc-900]:!text-slate-100`}
    >
      {isStageMaximized ? <div className="fixed inset-0 z-[140] bg-black/70" onClick={() => setIsStageMaximized(false)} /> : null}
      <div className={isStreamOnly ? "h-full w-full overflow-hidden" : "w-full"}>
        {!isStreamOnly ? (
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
                {!isEmbedded ? (
                  <Link
                    href="/knexai/web"
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Configuracoes no chat
                  </Link>
                ) : null}
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
        ) : null}

        <section className={isStreamOnly ? "grid gap-4" : "grid gap-4 xl:grid-cols-3 xl:items-stretch"}>
          <article
            className={`${isStreamOnly ? "relative bg-transparent p-0 shadow-none" : "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2"} ${
              isStageMaximized ? "fixed inset-2 z-[150] flex flex-col" : ""
            }`}
          >
            {!isStreamOnly ? (
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
                  <>
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
                  </>
                </div>
              </div>
            ) : null}
            <div className={`${isStreamOnly ? "mt-0" : "mt-3"} grid gap-3 ${!isStreamOnly && stageLayoutMode === "multi" ? "lg:grid-cols-[minmax(0,1fr)_230px]" : "grid-cols-1"}`}>
              <div>
                <div
                  className={`relative overflow-hidden border-0 bg-black outline-none ring-0 shadow-none ${isStreamOnly ? "" : "rounded-xl border border-slate-200"}`}
                >
                  {!isStreamOnly ? (
                    <div className="absolute left-3 top-3 z-[3] rounded-md bg-black/50 px-2 py-1 text-xs text-slate-200">
                      Principal: {primaryTile?.name || "Camera"}
                    </div>
                  ) : null}
                  <div className="relative aspect-video w-full bg-black">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`block h-full w-full border-0 outline-none ring-0 shadow-none ${isStreamOnly ? "object-contain" : "object-cover"}`}
                      style={
                        isStreamOnly
                          ? {
                              width: "calc(100% + 2px)",
                              marginLeft: "-1px",
                            }
                          : undefined
                      }
                    />
                    {cameraState === "streaming" && streamFaceBoxes.length > 0 ? (
                      <div className="pointer-events-none absolute inset-0 z-[2]">
                        {streamFaceBoxes.map((faceBox, index) => {
                          const stroke = index === 0 ? "#34d399" : index === 1 ? "#38bdf8" : index === 2 ? "#f59e0b" : "#a78bfa";
                          const label = asNonEmptyString(faceBox.trackId) || `face-${index + 1}`;
                          return (
                            <div key={`${label}-${index}`}>
                              <div
                                className="absolute rounded-md border-2 shadow-[0_0_0_1px_rgba(5,7,13,0.65)]"
                                style={{
                                  left: `${faceBox.left}px`,
                                  top: `${faceBox.top}px`,
                                  width: `${faceBox.width}px`,
                                  height: `${faceBox.height}px`,
                                  borderColor: stroke,
                                }}
                              />
                              <div
                                className="absolute rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                                style={{
                                  left: `${faceBox.left}px`,
                                  top: `${Math.max(0, faceBox.top - 20)}px`,
                                  backgroundColor: stroke,
                                }}
                              >
                                {label} {Math.round(faceBox.confidence * 100)}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                  {cameraState !== "streaming" ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 text-center text-sm text-slate-200">
                      <p>{cameraState === "starting" ? "Conectando camera local..." : "Sem sinal no palco principal."}</p>
                      <p className="max-w-md text-xs text-slate-400">
                        Permita acesso a camera no navegador para exibir o palco principal e os ambientes de validacao.
                      </p>
                      {isStreamOnly ? (
                        <button
                          type="button"
                          onClick={() => void startCameraPreview()}
                          disabled={cameraState === "starting"}
                          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                            cameraState === "starting"
                              ? "cursor-not-allowed border-slate-500 bg-slate-800 text-slate-300"
                              : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {cameraState === "starting" ? "Conectando..." : "Ativar camera"}
                        </button>
                      ) : null}
                      {cameraError ? <p className="max-w-md text-xs text-rose-300">{cameraError}</p> : null}
                    </div>
                  ) : null}
                  {!isStreamOnly ? (
                    <button
                      type="button"
                      onClick={capturePrimaryProfile}
                      className="absolute bottom-3 left-3 z-[3] rounded-md border border-slate-200/40 bg-black/50 px-2.5 py-1 text-xs font-medium text-slate-100 hover:bg-black/65"
                    >
                      Capturar perfil (Ambiente 1)
                    </button>
                  ) : null}
                </div>
              </div>
              {!isStreamOnly && stageLayoutMode === "multi" ? (
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
                              {cameraState === "streaming" ? "Aguardando captura de validacao" : "Aguardando Ambiente 1"}
                            </div>
                          ) : null}
                        </div>
                        <div className="bg-slate-900/90 px-2 py-1.5 text-xs text-slate-200">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">
                              {tile.name} - {pointLabel(slot).replace("Ambiente 2 - ", "").replace("Ambiente 3 - ", "").replace("Ambiente 4 - ", "")}
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
            {!isStreamOnly ? (
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
              <div className="mt-2 rounded-lg border border-slate-300 bg-white/70 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Banco de Pessoas Procuradas</p>
                    <p className="text-[11px] text-slate-500">
                      Ingestao ativa para busca dirigida. Ao inserir, ativa fluxo imediato de captura e demonstracao.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void fetchWantedPeople({ preserveSelection: true })}
                      disabled={wantedLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <RefreshCcw size={12} />
                      Atualizar banco
                    </button>
                    <button
                      type="button"
                      onClick={() => setWantedSearchModeEnabled((current) => !current)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        wantedSearchModeEnabled
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      {wantedSearchModeEnabled ? "Busca ativa ON" : "Busca ativa OFF"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setWantedAutoCycleEnabled((current) => !current)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        wantedAutoCycleEnabled
                          ? "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
                          : "border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      {wantedAutoCycleEnabled ? "Rotacao ON" : "Rotacao OFF"}
                    </button>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <input
                    value={wantedDisplayName}
                    onChange={(event) => setWantedDisplayName(event.target.value)}
                    placeholder="Nome da pessoa procurada (novo cadastro)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                  />
                  <select
                    value={selectedWantedPersonId}
                    onChange={(event) => {
                      setSelectedWantedPersonId(event.target.value);
                      setReferenceCarouselIndex(0);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
                  >
                    {wantedPeople.length ? null : <option value="">Sem pessoa procurada cadastrada</option>}
                    {wantedPeople.map((person) => (
                      <option key={person.person_id} value={person.person_id}>
                        {person.display_name} ({person.person_id})
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center">
                    <input
                      ref={wantedIngestInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        void handleWantedIngestUpload(event);
                      }}
                    />
                    <button
                      type="button"
                      onClick={openWantedIngestPicker}
                      disabled={wantedIngestBusy}
                      className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                    >
                      <Database size={13} />
                      {wantedIngestBusy
                        ? "Ingerindo..."
                        : "Ingestao Pessoas Procuradas (Windows/Mac/Linux)"}
                    </button>
                  </div>
                </div>
                <div className="mt-2 grid gap-1 text-[11px] text-slate-600 md:grid-cols-2">
                  <p>
                    Pessoa ativa:{" "}
                    <strong>{selectedWantedPerson ? selectedWantedPerson.display_name : "-"}</strong>
                  </p>
                  <p>
                    Sessao backend: <strong>{wantedSearchSessionId || "-"}</strong>
                  </p>
                  <p>
                    Threshold preliminar:{" "}
                    <strong>{Math.round((selectedWantedPerson?.preliminary_similarity_threshold || 0.72) * 100)}%</strong>
                  </p>
                  <p>
                    Janela minima: <strong>{selectedWantedPerson?.min_window_ms || 2400} ms</strong>
                  </p>
                </div>
                {wantedNotice ? <p className="mt-1 text-xs text-sky-700">{wantedNotice}</p> : null}
                {wantedIngestNotice ? <p className="mt-1 text-xs text-emerald-600">{wantedIngestNotice}</p> : null}
                {wantedError ? <p className="mt-1 text-xs text-rose-600">{wantedError}</p> : null}
                {wantedIngestError ? <p className="mt-1 text-xs text-rose-600">{wantedIngestError}</p> : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <span>
                  Referencia ativa:{" "}
                  <strong>
                    {hasInducedReference
                      ? inducedReferenceAsset?.file_name || inducedReferenceAsset?.local_id || "-"
                      : wantedSearchModeEnabled
                        ? selectedWantedReferenceImage?.file_name || selectedWantedPerson?.display_name || "-"
                        : dbReferenceAsset?.file_name || dbReferenceAsset?.image_key || "-"}
                  </strong>
                </span>
                <span>Match em camadas: <strong>{layeredMatchState.pass ? "positivo" : "aguardando"}</strong></span>
                <span>Ambiente diagnostico: <strong>channel-1</strong></span>
                <span>Embedding facial: <strong>{faceEmbeddingStatus === "ready" ? "real ativo" : faceEmbeddingStatus === "error" ? "erro" : "aguardando"}</strong></span>
                <span>
                  Bounding box:{" "}
                  <strong>{cameraState !== "streaming" ? "off" : streamFaceBoxes.length > 0 ? `ativo (${streamFaceBoxes.length})` : "sem face"}</strong>
                </span>
                <span>Faces no frame: <strong>{streamAnalyzeSnapshot?.facesCount ?? 0}</strong></span>
                <span>Pose: <strong>{streamAnalyzeSnapshot ? `${streamAnalyzeSnapshot.poseLabel}${streamAnalyzeSnapshot.poseMatch ? " ok" : ""}` : "-"}</strong></span>
                <span>
                  Qualidade:{" "}
                  <strong>
                    {streamAnalyzeSnapshot
                      ? `${Math.round(streamAnalyzeSnapshot.qualityScore * 100)}%${streamAnalyzeSnapshot.qualityApproved ? " ok" : ""}`
                      : "-"}
                  </strong>
                </span>
                <span>Track principal: <strong>{streamAnalyzeSnapshot?.trackId || "-"}</strong></span>
                <span>Ultima autocaptura: <strong>{autoCaptureLastAt ? asPrettyDate(autoCaptureLastAt) : "-"}</strong></span>
                <span>
                  Pre-gate:{" "}
                  <strong>
                    {preliminaryGateSnapshot.enabled
                      ? `${Math.round(preliminaryGateSnapshot.similarity * 100)}% (${preliminaryGateSnapshot.consecutiveHits}/${preliminaryGateSnapshot.minConsecutiveHits})`
                      : "-"}
                  </strong>
                </span>
                <span>Estado pre-gate: <strong>{preliminaryGateSnapshot.trackState || "-"}</strong></span>
              </div>
              {inducedNotice ? <p className="mt-1 text-xs text-emerald-600">{inducedNotice}</p> : null}
              {inducedError ? <p className="mt-1 text-xs text-rose-600">{inducedError}</p> : null}
              {autoCaptureBusy ? <p className="mt-1 text-xs text-amber-600">Executando autocaptura autonoma nos ambientes de validacao 2, 3 e 4...</p> : null}
              {autoCaptureNotice ? <p className="mt-1 text-xs text-emerald-600">{autoCaptureNotice}</p> : null}
              {autoCaptureError ? <p className="mt-1 text-xs text-rose-600">{autoCaptureError}</p> : null}
              {streamAnalyzeError ? <p className="mt-1 text-xs text-amber-600">{streamAnalyzeError}</p> : null}
              </div>
            ) : null}
            {cameraError ? (
              <div className="mt-3 rounded-lg border border-rose-300 bg-rose-100/80 px-3 py-2 text-sm text-rose-800">{cameraError}</div>
            ) : null}
          </article>

          {!isStreamOnly ? (
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:flex xl:h-full xl:min-h-[560px] xl:flex-col xl:overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <UserRoundSearch size={18} className="text-fuchsia-600" />
                Entidades Rastreadas
              </h2>
              <p className="text-xs text-slate-500">Ambiente alvo: {selectedEntitySourceLabel}</p>
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
                        ? " - diagnostico"
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
                      Sem foto no banco/imagens para a entidade selecionada. Use a captura do Ambiente 1 e dos ambientes de validacao 2/3/4.
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
              Capturas locais: Ambiente 1 = {identifiedProfileImage ? "ok" : "pendente"} | Ambiente 2 ={" "}
              {embeddingCaptures.left.image ? "ok" : "pendente"} | Ambiente 3 = {embeddingCaptures.front.image ? "ok" : "pendente"} | Ambiente 4 ={" "}
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
          ) : null}
        </section>

        {!isStreamOnly ? (
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
        ) : null}

        {!isStreamOnly && loading ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Carregando runtime...</div>
        ) : null}
      </div>
    </main>
  );
}
