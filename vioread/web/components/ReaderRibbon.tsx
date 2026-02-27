"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BookOpenText,
  Bookmark,
  Bot,
  Clock3,
  ClipboardList,
  FileText,
  Hand,
  HardDrive,
  Highlighter,
  Monitor,
  MousePointer2,
  Pencil,
  RotateCcwSquare,
  RotateCwSquare,
  ScanLine,
  Search,
  Sparkles,
  SquarePen,
  Video,
  Type,
} from "lucide-react";
import { OPEN_PDF_PICKER_EVENT } from "../lib/constants";
import type { RecentDocumentEntry } from "../lib/types";
import { useReaderStore } from "../store/reader.store";

type RibbonTab =
  | "Arquivo"
  | "Pagina Inicial"
  | "Converter"
  | "Editar"
  | "Organizar"
  | "Comentario"
  | "Exibir"
  | "Formulario"
  | "Proteger"
  | "Foxit eSign"
  | "Compartilhar"
  | "Acessibilidade"
  | "Ajuda";

type HomeTool = {
  id: string;
  label: string;
  hasDropdown?: boolean;
  icon: ReactNode;
};

type HomeGroup = {
  id: string;
  tools: HomeTool[];
};

type FileMenuItem = {
  id: string;
  label: string;
  active?: boolean;
  muted?: boolean;
  dividerAbove?: boolean;
};

type FileOpenOption = {
  id: string;
  label: string;
  active?: boolean;
  icon: ReactNode;
};

const RIBBON_TABS: RibbonTab[] = [
  "Arquivo",
  "Pagina Inicial",
  "Converter",
  "Editar",
  "Organizar",
  "Comentario",
  "Exibir",
  "Formulario",
  "Proteger",
  "Foxit eSign",
  "Compartilhar",
  "Acessibilidade",
  "Ajuda",
];

const HOME_GROUPS: HomeGroup[] = [
  {
    id: "selection",
    tools: [
      { id: "hand", label: "Mao", icon: <Hand size={18} strokeWidth={1.9} /> },
      { id: "select", label: "Selecionar", hasDropdown: true, icon: <MousePointer2 size={18} strokeWidth={1.9} /> },
      { id: "snapshot", label: "Instantaneo", icon: <ScanLine size={18} strokeWidth={1.9} /> },
    ],
  },
  {
    id: "clipboard",
    tools: [{ id: "clipboard", label: "Area de transferencia", hasDropdown: true, icon: <ClipboardList size={18} strokeWidth={1.9} /> }],
  },
  {
    id: "bookmark",
    tools: [{ id: "bookmark", label: "Marcador", icon: <Bookmark size={18} strokeWidth={1.9} /> }],
  },
  {
    id: "zoom",
    tools: [
      { id: "zoom", label: "Zoom", hasDropdown: true, icon: <Search size={18} strokeWidth={1.9} /> },
      { id: "fit-page", label: "Opcao de Ajuste de Pagina", hasDropdown: true, icon: <SquarePen size={18} strokeWidth={1.9} /> },
    ],
  },
  {
    id: "view",
    tools: [
      { id: "reflow", label: "Refluxo", icon: <Type size={18} strokeWidth={1.9} /> },
      { id: "rotate-view", label: "Girar Visualizacao", hasDropdown: true, icon: <RotateCcwSquare size={18} strokeWidth={1.9} /> },
    ],
  },
  {
    id: "edit",
    tools: [
      { id: "edit-text", label: "Editar Texto", icon: <Type size={18} strokeWidth={1.9} /> },
      { id: "edit-object", label: "Editar Objeto", hasDropdown: true, icon: <Pencil size={18} strokeWidth={1.9} /> },
    ],
  },
  {
    id: "comment",
    tools: [
      { id: "typewriter", label: "Maquina de escrever", icon: <Type size={18} strokeWidth={1.9} /> },
      { id: "highlight", label: "Destacar", icon: <Highlighter size={18} strokeWidth={1.9} /> },
    ],
  },
  {
    id: "pages",
    tools: [
      { id: "rotate-pages", label: "Girar Paginas", hasDropdown: true, icon: <RotateCwSquare size={18} strokeWidth={1.9} /> },
      { id: "insert", label: "Inserir", hasDropdown: true, icon: <SquarePen size={18} strokeWidth={1.9} /> },
    ],
  },
  {
    id: "scanner",
    tools: [
      { id: "scan", label: "Do Scanner", hasDropdown: true, icon: <ScanLine size={18} strokeWidth={1.9} /> },
      { id: "ocr", label: "Reconhecimento Rapido", icon: <Sparkles size={18} strokeWidth={1.9} /> },
    ],
  },
  {
    id: "signature",
    tools: [{ id: "sign", label: "Preencher e Assinar", icon: <Pencil size={18} strokeWidth={1.9} /> }],
  },
  {
    id: "assistant",
    tools: [{ id: "ai", label: "Assistente de IA", icon: <Bot size={18} strokeWidth={1.9} /> }],
  },
];

const FILE_MENU_ITEMS: FileMenuItem[] = [
  { id: "props", label: "Propriedades" },
  { id: "create", label: "Criar" },
  { id: "open", label: "Abrir", active: true },
  { id: "save", label: "Salvar" },
  { id: "save-as", label: "Salvar como" },
  { id: "optimizer", label: "Otimizador de PDF" },
  { id: "actions", label: "Assistente de Acao" },
  { id: "export", label: "Exportar" },
  { id: "print", label: "Imprimir" },
  { id: "batch", label: "Impressao em Lote" },
  { id: "index", label: "Indice" },
  { id: "share", label: "Compartilhar" },
  { id: "revert", label: "Reverter", muted: true },
  { id: "close", label: "Fechar" },
  { id: "prefs", label: "Preferencias", dividerAbove: true },
  { id: "appearance", label: "Aparencias" },
];

const FILE_OPEN_OPTIONS: FileOpenOption[] = [
  { id: "recent", label: "Documentos Recentes", active: true, icon: <Clock3 size={16} strokeWidth={1.9} /> },
  { id: "computer", label: "Computador", icon: <Monitor size={16} strokeWidth={1.9} /> },
  { id: "place", label: "Adicionar um lugar", icon: <HardDrive size={16} strokeWidth={1.9} /> },
];

function formatSize(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function formatRecentMeta(entry: RecentDocumentEntry) {
  const pages = `${Math.max(1, entry.pageCount)} pág.`;
  const size = formatSize(entry.sizeBytes);
  return [entry.sourceLabel, pages, size].filter(Boolean).join(" • ");
}

function formatRecentDate(value: number) {
  return new Date(value).toLocaleString("pt-BR");
}

function renderHomeContent() {
  return (
    <div className="reader-ribbon-content">
      {HOME_GROUPS.map((group) => (
        <div key={group.id} className="reader-ribbon-tool-group">
          {group.tools.map((tool) => (
            <button key={tool.id} type="button" className="reader-ribbon-tool-btn" title={tool.label} aria-label={tool.label}>
              <span className="reader-ribbon-tool-icon">{tool.icon}</span>
              <span className="reader-ribbon-tool-text">
                {tool.label}
                {tool.hasDropdown ? <span className="reader-ribbon-tool-caret">v</span> : null}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function renderFileContent(onOpenFile: () => void, recentDocs: RecentDocumentEntry[]) {
  return (
    <div className="reader-file-stage">
      <aside className="reader-file-left-menu" aria-label="Menu Arquivo">
        {FILE_MENU_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`reader-file-menu-item ${item.active ? "active" : ""} ${item.muted ? "muted" : ""} ${item.dividerAbove ? "divider" : ""}`}
            onClick={item.id === "open" ? onOpenFile : undefined}
          >
            {item.label}
          </button>
        ))}
      </aside>

      <aside className="reader-file-open-options" aria-label="Abrir">
        <h3 className="reader-file-column-title">Abrir</h3>
        <div className="reader-file-open-list">
          {FILE_OPEN_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`reader-file-open-item ${option.active ? "active" : ""}`}
              onClick={option.id === "computer" ? onOpenFile : undefined}
            >
              <span className="reader-file-open-icon">{option.icon}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="reader-file-recent" aria-label="Documentos Recentes">
        <h3 className="reader-file-column-title">Documentos Recentes</h3>
        <p className="reader-file-subtitle">Local</p>
        {!recentDocs.length ? (
          <p className="reader-file-recent-empty">Nenhum documento recente ainda.</p>
        ) : (
          <ul className="reader-file-recent-list">
            {recentDocs.map((doc) => (
              <li key={`recent-file-${doc.hash}`} className="reader-file-recent-item">
                <FileText size={16} strokeWidth={1.9} className="reader-file-doc-icon" />
                <div className="reader-file-doc-meta">
                  <p className="reader-file-doc-title">{doc.name}</p>
                  <p className="reader-file-doc-path">{formatRecentMeta(doc)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function renderHomeStartContent(onOpenFile: () => void, recentDocs: RecentDocumentEntry[]) {
  return (
    <div className="reader-home-stage">
      <aside className="reader-home-left">
        <button type="button" className="reader-home-nav-item active">
          <SquarePen size={16} strokeWidth={1.9} />
          <span>Pagina Inicial</span>
        </button>
        <button type="button" className="reader-home-nav-item">
          <Video size={16} strokeWidth={1.9} />
          <span>Tutoriais em Video</span>
        </button>

        <button type="button" className="reader-home-open-btn" onClick={onOpenFile}>
          Abrir Arquivo
        </button>

        <a href="#" className="reader-home-support" onClick={(event) => event.preventDefault()}>
          Visitar o Centro de Suporte
        </a>
      </aside>

      <section className="reader-home-main">
        <header className="reader-home-header">
          <h3>Assistente de Ferramentas</h3>
          <p>(Ferramentas frequentemente usadas)</p>
        </header>

        <div className="reader-home-tool-cards">
          <article className="reader-home-tool-card">
            <span className="reader-home-tool-avatar blue">
              <SquarePen size={20} strokeWidth={1.9} />
            </span>
            <div className="reader-home-tool-text">
              <h4>Editar PDF</h4>
              <p>Editar o documento e formatacao de texto</p>
              <button type="button">Usar agora</button>
            </div>
          </article>

          <article className="reader-home-tool-card">
            <span className="reader-home-tool-avatar cyan">
              <Sparkles size={20} strokeWidth={1.9} />
            </span>
            <div className="reader-home-tool-text">
              <h4>Destacar</h4>
              <p>Destacar Texto</p>
              <button type="button">Usar agora</button>
            </div>
          </article>

          <article className="reader-home-tool-card">
            <span className="reader-home-tool-avatar green">
              <BookOpenText size={20} strokeWidth={1.9} />
            </span>
            <div className="reader-home-tool-text">
              <h4>Modo de Leitura</h4>
              <p>Remove elementos da interface para maximizar espaco.</p>
              <button type="button">Usar agora</button>
            </div>
          </article>
        </div>

        <section className="reader-home-recents">
          <div className="reader-home-recents-head">
            <h4>Recentes</h4>
          </div>
          <div className="reader-home-recents-table-head">
            <span>Nome</span>
            <span>Data de Modificacao</span>
          </div>
          {!recentDocs.length ? (
            <p className="reader-home-recents-empty">Nenhum documento aberto ainda.</p>
          ) : (
            <ul className="reader-home-recents-list">
              {recentDocs.map((doc) => (
                <li key={`home-${doc.hash}`} className="reader-home-recents-item">
                  <div className="reader-home-recent-doc">
                    <FileText size={16} strokeWidth={1.9} className="reader-home-doc-icon" />
                    <div className="reader-home-doc-meta">
                      <p>{doc.name}</p>
                      <span>{formatRecentMeta(doc)}</span>
                    </div>
                  </div>
                  <span className="reader-home-recent-date">{formatRecentDate(doc.openedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </div>
  );
}

export default function ReaderRibbon() {
  const [activeTab, setActiveTab] = useState<RibbonTab>("Pagina Inicial");
  const openedDocument = useReaderStore((state) => state.document);
  const recentDocuments = useReaderStore((state) => state.recentDocuments);
  const hydrateRecentDocuments = useReaderStore((state) => state.hydrateRecentDocuments);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [fileOverlayTop, setFileOverlayTop] = useState(82);
  const isFileMode = activeTab === "Arquivo";
  const isHomeStartMode = activeTab === "Pagina Inicial" && !openedDocument;
  const isOverlayMode = isFileMode || isHomeStartMode;
  const triggerOpenFilePicker = () => {
    window.dispatchEvent(new Event(OPEN_PDF_PICKER_EVENT));
  };

  useEffect(() => {
    hydrateRecentDocuments();
  }, [hydrateRecentDocuments]);

  useEffect(() => {
    if (!isOverlayMode) return;

    const updateOverlayTop = () => {
      if (!tabsRef.current) return;
      const rect = tabsRef.current.getBoundingClientRect();
      setFileOverlayTop(Math.round(rect.bottom));
    };

    updateOverlayTop();
    window.addEventListener("resize", updateOverlayTop);
    window.addEventListener("scroll", updateOverlayTop, true);

    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("resize", updateOverlayTop);
      window.removeEventListener("scroll", updateOverlayTop, true);
      window.document.body.style.overflow = previousOverflow;
    };
  }, [isOverlayMode]);

  const content = useMemo(() => {
    if (activeTab === "Pagina Inicial") {
      if (!openedDocument) return renderHomeStartContent(triggerOpenFilePicker, recentDocuments);
      return renderHomeContent();
    }

    if (activeTab === "Arquivo") {
      return renderFileContent(triggerOpenFilePicker, recentDocuments);
    }

    return (
      <div className="reader-ribbon-placeholder">
        Guia <strong>{activeTab}</strong> pronta para configuracao. Envie as opcoes desta guia para eu montar os blocos.
      </div>
    );
  }, [activeTab, openedDocument, recentDocuments]);

  return (
    <section className="reader-ribbon" aria-label="Painel de funcionalidades">
      <div ref={tabsRef} className="reader-ribbon-tabs" role="tablist" aria-label="Guias de funcionalidades">
        {RIBBON_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`reader-ribbon-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div
        className={`reader-ribbon-panel ${isFileMode ? "file-mode" : ""} ${isHomeStartMode ? "home-mode" : ""}`}
        style={isOverlayMode ? { top: `${fileOverlayTop}px` } : undefined}
      >
        {content}
      </div>
    </section>
  );
}
