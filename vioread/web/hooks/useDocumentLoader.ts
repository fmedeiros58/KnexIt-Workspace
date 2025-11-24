import { useCallback } from "react";
import type { DocumentDescriptor, VioReadDocument } from "../lib/vioreadTypes";

// TODO: integrar com SupaDrive/Supabase de fato.
async function fetchFromSupaDrive(descriptor: DocumentDescriptor): Promise<VioReadDocument> {
  return {
    id: descriptor.id || `supadrive-${Date.now()}`,
    title: descriptor.name,
    language: "en",
    summary: "Mock de documento vindo do SupaDrive. TODO: buscar conteúdo real via Supabase/storage.",
    sections: [
      {
        id: "sd-intro",
        title: "Introdução (mock)",
        blocks: [
          { id: "sd-b1", kind: "paragraph", text: "Conteúdo fictício carregado do SupaDrive para demonstrar o fluxo." },
        ],
      },
    ],
  };
}

async function fromUpload(descriptor: DocumentDescriptor): Promise<VioReadDocument> {
  const text = descriptor.payload?.content || "Conteúdo não lido do arquivo (mock).";
  return {
    id: descriptor.id || `upload-${Date.now()}`,
    title: descriptor.name,
    language: "en",
    summary: "Documento enviado por upload (mock).",
    sections: [
      { id: "up-1", title: "Arquivo enviado", blocks: [{ id: "up-b1", kind: "paragraph", text }] },
    ],
  };
}

async function fromRawText(descriptor: DocumentDescriptor): Promise<VioReadDocument> {
  const text = descriptor.payload?.content || "Texto colado (mock).";
  return {
    id: descriptor.id || `raw-${Date.now()}`,
    title: descriptor.name || "Texto colado",
    language: "en",
    summary: "Conteúdo de texto colado ou URL (mock).",
    sections: [{ id: "raw-1", title: "Conteúdo", blocks: [{ id: "raw-b1", kind: "paragraph", text }] }],
  };
}

export function useDocumentLoader() {
  const loadDocument = useCallback(async (descriptor: DocumentDescriptor): Promise<VioReadDocument> => {
    if (descriptor.source === "supadrive") return fetchFromSupaDrive(descriptor);
    if (descriptor.source === "upload") return fromUpload(descriptor);
    return fromRawText(descriptor);
  }, []);

  return { loadDocument };
}

