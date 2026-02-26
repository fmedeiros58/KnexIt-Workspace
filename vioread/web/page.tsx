"use client";

import {
  ChevronDown,
  CircleUserRound,
  FilePlus2,
  FileText,
  FolderOpen,
  Hand,
  Minus,
  Printer,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Square,
  Undo2,
  X,
} from "lucide-react";
import ReaderRibbon from "./components/ReaderRibbon";
import ReaderShell from "./components/ReaderShell";

const HEADER_ACTIONS = [
  { id: "app", icon: RotateCcw, label: "Ações do app" },
  { id: "open", icon: FolderOpen, label: "Abrir" },
  { id: "save", icon: Save, label: "Salvar" },
  { id: "print", icon: Printer, label: "Imprimir" },
  { id: "file", icon: FileText, label: "Documento" },
  { id: "file-add", icon: FilePlus2, label: "Novo documento" },
  { id: "undo", icon: Undo2, label: "Desfazer" },
  { id: "redo", icon: Redo2, label: "Refazer" },
  { id: "hand", icon: Hand, label: "Ferramenta mão" },
];

export default function VioReadPage() {
  return (
    <main className="reader-app">
      <header className="reader-titlebar">
        <div className="reader-titlebar-left">
          <div className="reader-titlebar-tools" aria-label="Ações rápidas">
            {HEADER_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.id} type="button" className="reader-title-icon-btn" title={action.label} aria-label={action.label}>
                  <Icon size={16} strokeWidth={1.8} />
                </button>
              );
            })}
            <span className="reader-title-sep" />
            <button type="button" className="reader-title-icon-btn" title="Mais opções" aria-label="Mais opções">
              <ChevronDown size={16} strokeWidth={1.8} />
            </button>
          </div>

          <div className="reader-titlebar-doc" title="R59 - Stress-and-allostasis-induced brain plasticity">
            <span className="reader-title">R59 - Stress-and-allostasis-induced brain plasticity</span>
          </div>
        </div>

        <div className="reader-titlebar-search-center">
          <div className="reader-titlebar-search">
            <Search size={16} strokeWidth={1.9} className="reader-search-icon" />
            <input className="reader-search" placeholder="Pesquisar" aria-label="Pesquisar" />
          </div>
        </div>

        <div className="reader-titlebar-right">
          <button type="button" className="reader-title-icon-btn" title="Perfil" aria-label="Perfil">
            <CircleUserRound size={16} strokeWidth={1.9} />
          </button>
          <button type="button" className="reader-title-icon-btn" title="Conta" aria-label="Conta">
            <ChevronDown size={14} strokeWidth={1.8} />
          </button>
          <span className="reader-title-sep" />
          <button type="button" className="reader-window-action" title="Minimizar" aria-label="Minimizar">
            <Minus size={14} strokeWidth={2.1} />
          </button>
          <button type="button" className="reader-window-action" title="Maximizar" aria-label="Maximizar">
            <Square size={13} strokeWidth={2} />
          </button>
          <button type="button" className="reader-window-action danger" title="Fechar" aria-label="Fechar">
            <X size={14} strokeWidth={2.1} />
          </button>
        </div>
      </header>

      <ReaderRibbon />

      <div className="reader-app-body">
        <ReaderShell />
      </div>
    </main>
  );
}
