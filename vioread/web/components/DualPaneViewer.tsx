"use client";

import type { VioReadDocument, VioReadBlock } from "../lib/vioreadTypes";

type Props = {
  original: VioReadDocument | null;
  translated: VioReadDocument | null;
};

function Pane({ document, label }: { document: VioReadDocument | null; label: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        <div className="text-xs text-slate-500">{document?.language || "?"}</div>
      </div>
      {document ? (
        <div className="space-y-6">
          {document.sections.map((sec) => (
            <section key={sec.id} className="border-b border-slate-100 pb-4">
              {sec.title ? <h3 className="text-base font-semibold text-slate-900 mb-2">{sec.title}</h3> : null}
              {sec.blocks.map((b) => (
                <Block key={b.id} block={b} />
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-500">Sem conteúdo disponível.</div>
      )}
    </div>
  );
}

function Block({ block }: { block: VioReadBlock }) {
  if (block.kind === "heading") return <h4 className="text-lg font-semibold text-slate-900 mt-4 mb-2">{block.text}</h4>;
  if (block.kind === "paragraph") return <p className="text-slate-800 leading-7 mb-3">{block.text}</p>;
  if (block.kind === "list") {
    return (
      <ul className="list-disc list-inside text-slate-800 leading-7 mb-3">
        {(block.items || []).map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    );
  }
  return <p className="text-slate-700 mb-3">{block.text}</p>;
}

export default function DualPaneViewer({ original, translated }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Pane document={original} label="Original" />
      <Pane document={translated} label="Traduzido" />
    </div>
  );
}

