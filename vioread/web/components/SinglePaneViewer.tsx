"use client";

import type { VioReadDocument, VioReadBlock } from "../lib/vioreadTypes";

type Props = {
  document: VioReadDocument | null;
};

function Block({ block }: { block: VioReadBlock }) {
  if (block.kind === "heading") return <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-2">{block.text}</h3>;
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

export default function SinglePaneViewer({ document }: Props) {
  if (!document) {
    return <div className="text-sm text-slate-500">Selecione um documento para começar.</div>;
  }

  return (
    <article className="max-w-4xl">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-slate-500">Idioma: {document.language || "?"}</p>
        <h1 className="text-2xl font-bold text-slate-900">{document.title}</h1>
        {document.summary ? <p className="mt-2 text-slate-600">{document.summary}</p> : null}
      </header>

      <div>
        {document.sections.map((sec) => (
          <section key={sec.id} className="mb-8">
            {sec.title ? <h2 className="text-lg font-semibold text-slate-900 mb-2">{sec.title}</h2> : null}
            {sec.blocks.map((b) => (
              <Block key={b.id} block={b} />
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}

