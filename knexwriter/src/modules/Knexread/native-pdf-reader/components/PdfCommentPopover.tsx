"use client";

import { useState } from "react";

export function PdfCommentPopover({
  position,
  onCancel,
  onSave,
}: {
  position: { top: number; left: number } | null;
  onCancel: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState("");
  if (!position) return null;

  return (
    <div
      className="fixed z-[3300] w-72 rounded-md border border-zinc-200 bg-white p-3 shadow-xl"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <p className="mb-2 text-xs font-medium text-zinc-700">Comentario</p>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        className="w-full rounded border border-zinc-300 p-2 text-sm outline-none focus:border-blue-400"
        placeholder="Adicione uma observacao para este trecho..."
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onSave(text)}
          className="rounded bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-800"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
