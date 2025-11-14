"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { listRecordings, type DriveRecordingMeta } from "@/lib/recstore";

export default function SharePage() {
  const params = useParams();
  const idParam = Array.isArray(params?.id) ? params?.id[0] : (params?.id as string | undefined);
  const recId = idParam ? Number(idParam) : NaN;
  const [record, setRecord] = useState<DriveRecordingMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const items = await listRecordings();
        const found = items.find((r) => r.id === recId) || null;
        if (alive) setRecord(found);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [recId]);

  const title = useMemo(() => {
    if (!record) return "Compartilhar";
    const name = record.name && record.name.trim().length > 0 ? record.name : "Arquivo";
    return `Compartilhar "${name}"`;
  }, [record]);

  const copyLink = async () => {
    const url = typeof window !== "undefined" ? `${location.origin}/upconect/drive/share/${recId}` : "";
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copiado para a área de transferência");
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Link copiado para a área de transferência");
    }
  };

  const done = () => {
    if (typeof window !== "undefined") window.close();
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 p-6">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <div className="text-xl font-semibold leading-snug">{title}</div>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <button className="h-8 w-8 grid place-items-center rounded hover:bg-slate-100" title="Ajuda">❓</button>
            <button className="h-8 w-8 grid place-items-center rounded hover:bg-slate-100" title="Configurações">⚙</button>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Adicionar participantes, grupos, espaços e eventos da agenda"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="mb-6">
            <div className="text-sm font-medium mb-2">Pessoas com acesso</div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-200" />
                <div>
                  <div className="text-sm font-medium">Você</div>
                  <div className="text-xs text-slate-600">{record?.owner || ""}</div>
                </div>
              </div>
              <div className="text-xs text-slate-500">Proprietário</div>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-sm font-medium mb-2">Acesso geral</div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2 text-slate-700">
                <span className="text-lg">🔒</span>
                <span className="text-sm">Restrito</span>
              </div>
              <button className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
                Alterar
                <span className="text-slate-500">▾</span>
              </button>
            </div>
            <div className="mt-1 text-xs text-slate-500">Só as pessoas com acesso podem abrir usando o link.</div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
              onClick={copyLink}
            >
              <span className="text-base">🔗</span>
              Copiar link
            </button>
            <button
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={done}
            >
              Concluído
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 text-center text-sm text-slate-500">Carregando…</div>
      ) : null}
    </div>
  );
}

