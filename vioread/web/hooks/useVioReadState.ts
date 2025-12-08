"use client";

import { useState, useCallback } from "react";
import type { DocumentDescriptor, VioReadDocument } from "../lib/vioreadTypes";
import { useDocumentLoader } from "./useDocumentLoader";

const MOCK_DOC: VioReadDocument = {
  id: "sample",
  title: "Artigo de Machine Learning",
  language: "en",
  summary: "Um artigo fictício para testar o fluxo de leitura e tradução.",
  sections: [
    {
      id: "intro",
      title: "Introdução",
      blocks: [
        { id: "b1", kind: "paragraph", text: "Este é um documento de exemplo para o VioRead." },
        { id: "b2", kind: "paragraph", text: "Ele demonstra como a tradução e a leitura assistida podem funcionar." },
      ],
    },
    {
      id: "methods",
      title: "Metodologia",
      blocks: [
        { id: "b3", kind: "heading", text: "Coleta de Dados" },
        { id: "b4", kind: "paragraph", text: "Os dados foram coletados de várias fontes públicas." },
        { id: "b5", kind: "heading", text: "Modelagem" },
        { id: "b6", kind: "paragraph", text: "Um modelo transformer foi usado para a tradução contextual." },
      ],
    },
  ],
};

export function useVioReadState() {
  const { loadDocument } = useDocumentLoader();
  const [document, setDocumentState] = useState<VioReadDocument | null>(MOCK_DOC);
  const [translated, setTranslated] = useState<VioReadDocument | null>(null);
  const [mode, setMode] = useState<"single" | "dual">("single");
  const [sourceLang, setSourceLang] = useState<string>("en");
  const [targetLang, setTargetLang] = useState<string>("pt");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const setDocument = useCallback(
    async (descriptor: DocumentDescriptor) => {
      const loaded = await loadDocument(descriptor);
      setDocumentState(loaded);
      setTranslated(null);
      setActiveSectionId(null);
    },
    [loadDocument]
  );

  return {
    document,
    translated,
    mode,
    sourceLang,
    targetLang,
    activeSectionId,
    setDocument,
    setTranslated,
    setMode,
    setSourceLang,
    setTargetLang,
    setActiveSectionId,
  };
}

