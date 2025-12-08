"use client";

import { useState } from "react";
import { requestExplain, requestSummary, requestKeyConcepts } from "../lib/vioreadApi";

export default function SelectionActionsPanel() {
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const run = async (action: "explain" | "summary" | "concepts") => {
    setLoading(true);
    try {
      if (action === "explain") {
        const res = await requestExplain({ fragment: "Trecho selecionado (mock)" });
        setOutput(res.explanation);
      } else if (action === "summary") {
        const res = await requestSummary({ section: "Seção atual (mock)" });
        setOutput(res.summary);
      } else {
        const res = await requestKeyConcepts({ section: "Seção atual (mock)" });
        setOutput(res.concepts.join(", "));
      }
    } catch (e) {
      setOutput("Falha ao executar ação (mock).");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Ações da IA</h3>
        <p className="text-xs text-slate-500">Explicar, resumir ou extrair conceitos do trecho/ seção atual.</p>
      </div>
      <div className="flex flex-col gap-2">
        <button
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          onClick={() => run("explain")}
          disabled={loading}
        >
          Explicar este trecho
        </button>
        <button
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          onClick={() => run("summary")}
          disabled={loading}
        >
          Resumir esta seção
        </button>
        <button
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          onClick={() => run("concepts")}
          disabled={loading}
        >
          Gerar fichamento / conceitos-chave
        </button>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 min-h-[100px]">
        {loading ? "Processando..." : output || "Resultado aparecerá aqui."}
      </div>
      <div className="text-xs text-slate-500">
        TODO: exportar para KnexDocs ou anexar a uma aula no VioClass.
      </div>
    </div>
  );
}

