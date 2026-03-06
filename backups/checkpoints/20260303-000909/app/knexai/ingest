"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type IngestSingleResult = {
  jobId: number | null;
  documentId: number;
  duplicate: boolean;
  contentHash: string;
  sourceType: string;
  sourcePath: string;
  title: string | null;
  chunkCount: number;
  status: string;
  rawFilePath: string;
  extractedTextPath: string;
  parser: "utf8" | "docx" | "pdf";
  embeddingStatus: "completed" | "failed" | "pending";
};

type IngestSingleResponse = {
  ok: boolean;
  mode?: "single" | "bulk";
  code?: string;
  message?: string;
  result?: IngestSingleResult;
};

type IngestionJobPayload = {
  ok: boolean;
  code?: string;
  message?: string;
  job?: {
    id: number;
    status: string;
    errorMessage: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
    documentId: number | null;
    documentStatus: string | null;
    contentHash: string | null;
    sourceType: string | null;
    sourcePath: string | null;
  };
};

type DocumentPayload = {
  ok: boolean;
  code?: string;
  message?: string;
  document?: {
    id: number;
    sourceType: string;
    sourcePath: string;
    contentHash: string;
    title: string | null;
    status: string;
    totalChunks: number;
    metadata: Record<string, unknown>;
    chunks: Array<{
      chunkIndex: number;
      text: string;
      tokenCount: number | null;
      charStart: number;
      charEnd: number;
    }>;
  };
};

const SESSION_STORAGE_KEY = "knexai_session_id";

function resolveSessionId() {
  if (typeof window === "undefined") return "";
  const fromStorage = window.localStorage.getItem(SESSION_STORAGE_KEY)?.trim();
  if (fromStorage) return fromStorage;
  const generated = `knx-${crypto.randomUUID()}`;
  window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const bodyText = await response.text();
  if (!bodyText) return null;
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    return null;
  }
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function KnexAiIngestPage() {
  const [sessionId, setSessionId] = useState("");
  const [sourceTypeUpload, setSourceTypeUpload] = useState("user_upload");
  const [sourceTypeReference, setSourceTypeReference] = useState("server_reference");
  const [title, setTitle] = useState("");
  const [filePath, setFilePath] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [isSubmittingUpload, setIsSubmittingUpload] = useState(false);
  const [isSubmittingReference, setIsSubmittingReference] = useState(false);
  const [feedback, setFeedback] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [lastResult, setLastResult] = useState<IngestSingleResult | null>(null);
  const [jobPayload, setJobPayload] = useState<IngestionJobPayload | null>(null);
  const [documentPayload, setDocumentPayload] = useState<DocumentPayload | null>(null);

  useEffect(() => {
    setSessionId(resolveSessionId());
  }, []);

  const canSubmitUpload = useMemo(() => !!file && !isSubmittingUpload, [file, isSubmittingUpload]);
  const canSubmitReference = useMemo(() => !!filePath.trim() && !isSubmittingReference, [filePath, isSubmittingReference]);

  const loadDetails = async (result: IngestSingleResult) => {
    setLastResult(result);

    if (result.jobId) {
      const jobResponse = await fetch(`/api/ingest/${result.jobId}`, { method: "GET", cache: "no-store" });
      const jobData = await parseJsonResponse<IngestionJobPayload>(jobResponse);
      setJobPayload(jobData);
    }

    const documentResponse = await fetch(`/api/documents/${result.documentId}?limit=20`, {
      method: "GET",
      cache: "no-store",
    });
    const documentData = await parseJsonResponse<DocumentPayload>(documentResponse);
    setDocumentPayload(documentData);
  };

  const handleUploadSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;

    setError("");
    setFeedback("");
    setIsSubmittingUpload(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (sessionId.trim()) formData.append("sessionId", sessionId.trim());
      if (title.trim()) formData.append("title", title.trim());
      if (sourceTypeUpload.trim()) formData.append("sourceType", sourceTypeUpload.trim());
      formData.append("metadata", JSON.stringify({ ingested_via: "web_ui_upload" }));

      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      const payload = await parseJsonResponse<IngestSingleResponse>(response);
      if (!response.ok || !payload?.ok || !payload.result) {
        throw new Error(payload?.message || `Falha na ingestao (HTTP ${response.status}).`);
      }

      await loadDetails(payload.result);
      setFeedback(
        `Arquivo ingerido com sucesso. jobId=${payload.result.jobId ?? "n/a"}, documentId=${payload.result.documentId}, embeddingStatus=${payload.result.embeddingStatus}.`,
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Falha ao enviar arquivo para ingestao.");
    } finally {
      setIsSubmittingUpload(false);
    }
  };

  const handleReferenceSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!filePath.trim()) return;

    setError("");
    setFeedback("");
    setIsSubmittingReference(true);

    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: filePath.trim(),
          sessionId: sessionId.trim() || undefined,
          title: title.trim() || undefined,
          sourceType: sourceTypeReference.trim() || "server_reference",
          metadata: { ingested_via: "web_ui_reference" },
        }),
      });

      const payload = await parseJsonResponse<IngestSingleResponse>(response);
      if (!response.ok || !payload?.ok || !payload.result) {
        throw new Error(payload?.message || `Falha na ingestao por referencia (HTTP ${response.status}).`);
      }

      await loadDetails(payload.result);
      setFeedback(
        `Referencia ingerida com sucesso. jobId=${payload.result.jobId ?? "n/a"}, documentId=${payload.result.documentId}, embeddingStatus=${payload.result.embeddingStatus}.`,
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Falha ao ingerir referencia de arquivo.");
    } finally {
      setIsSubmittingReference(false);
    }
  };

  const refreshCurrent = async () => {
    if (!lastResult) return;
    setError("");
    setFeedback("");
    try {
      await loadDetails(lastResult);
      setFeedback("Status atualizado.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao atualizar status.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Ingestao de Documentos (RAG)</h1>
          <p className="mt-1 text-sm text-slate-600">
            Upload via browser ou referencia de arquivo ja existente no servidor.
          </p>
        </div>
        <Link
          href="/knexai"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Voltar ao KnexAI
        </Link>
      </div>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Contexto da Sessao</h2>
        <p className="mt-1 text-sm text-slate-600">O sessionId garante rastreabilidade da ingestao no backend.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">sessionId</span>
            <input
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              placeholder="knx-..."
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">title (opcional)</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              placeholder="Titulo do documento"
            />
          </label>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Upload pelo Browser</h2>
          <p className="mt-1 text-sm text-slate-600">Envia arquivo diretamente para `POST /api/ingest` (multipart).</p>
          <form className="mt-4 space-y-3" onSubmit={(event) => void handleUploadSubmit(event)}>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Arquivo</span>
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">sourceType</span>
              <input
                value={sourceTypeUpload}
                onChange={(event) => setSourceTypeUpload(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
            </label>
            <button
              type="submit"
              disabled={!canSubmitUpload}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmittingUpload ? "Enviando..." : "Ingerir arquivo"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Referencia de Arquivo no Servidor</h2>
          <p className="mt-1 text-sm text-slate-600">
            Para `filePath` relativo, o backend resolve a partir de `RAG_ADMIN_BULK_BASE_PATH` (default `data/rag/bulk`).
          </p>
          <form className="mt-4 space-y-3" onSubmit={(event) => void handleReferenceSubmit(event)}>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">filePath</span>
              <input
                value={filePath}
                onChange={(event) => setFilePath(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                placeholder="ex: contratos/manual-rag.txt"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">sourceType</span>
              <input
                value={sourceTypeReference}
                onChange={(event) => setSourceTypeReference(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
            </label>
            <button
              type="submit"
              disabled={!canSubmitReference}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmittingReference ? "Ingerindo..." : "Ingerir por filePath"}
            </button>
          </form>
        </section>
      </div>

      {feedback ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{feedback}</div>
      ) : null}
      {error ? <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Ultimo Resultado</h2>
          <button
            type="button"
            onClick={() => void refreshCurrent()}
            disabled={!lastResult}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Atualizar status
          </button>
        </div>

        {!lastResult ? (
          <p className="text-sm text-slate-600">Nenhuma ingestao executada nesta tela ainda.</p>
        ) : (
          <div className="space-y-4">
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{prettyJson(lastResult)}</pre>
            {jobPayload ? (
              <div>
                <p className="mb-1 text-sm font-medium text-slate-800">Job</p>
                <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{prettyJson(jobPayload)}</pre>
              </div>
            ) : null}
            {documentPayload ? (
              <div>
                <p className="mb-1 text-sm font-medium text-slate-800">Documento</p>
                <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                  {prettyJson(documentPayload)}
                </pre>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Onde colocar arquivos no servidor (sem upload web)</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Diretorio recomendado para referencia manual: `data/rag/bulk`.</li>
          <li>Ao usar `filePath` relativo na API/web, o backend resolve a partir de `RAG_ADMIN_BULK_BASE_PATH`.</li>
          <li>Arquivos brutos ingeridos ficam em `data/rag/raw` (organizados por sessao/hash).</li>
          <li>Texto extraido fica em `data/rag/text`.</li>
        </ul>
      </section>
    </main>
  );
}
