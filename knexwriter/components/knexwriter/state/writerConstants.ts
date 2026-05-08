export const PAGE_AUDIT = {
  title: "KnexWriter",
  sector: "Editor inteligente de escrita",
  productArea: "KnexSpace One",
  route: "/knexwriter/web",
  purpose: "Escrita assistida por IA com projetos, seções, paginação e análise textual futura.",
} as const;

export const WRITING_NAV_MIN_WIDTH_PERCENT = 16;
export const WRITING_NAV_MAX_WIDTH_PERCENT = 44;
export const WRITING_NAV_DEFAULT_WIDTH_PERCENT = 24;

export const WRITING_WORKS_MIN_WIDTH_PERCENT = 18;
export const WRITING_WORKS_MAX_WIDTH_PERCENT = 44;
export const WRITING_WORKS_DEFAULT_WIDTH_PERCENT = 24;

export const WRITING_HORIZONTAL_RULER_HEIGHT_PX = 28;
export const WRITING_VERTICAL_RULER_WIDTH_PX = WRITING_HORIZONTAL_RULER_HEIGHT_PX;

export const WRITING_CANVAS_ZOOM_MIN_PERCENT = 50;
export const WRITING_CANVAS_ZOOM_MAX_PERCENT = 180;
export const WRITING_CANVAS_ZOOM_STEP_PERCENT = 5;

export const KNEXWRITER_DOCUMENT_SETTINGS_STORAGE_KEY = "knexwriter_document_layout_settings_v1";
export const KNEXWRITER_ACCEPTED_FILE_EXTENSIONS = ".pdf,.doc,.docx,.txt,.html,.htm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/html";

export const KNEXWRITER_FILE_PICKER_OPTIONS = {
  multiple: false,
  excludeAcceptAllOption: false,
  types: [
    {
      description: "Documentos do KnexWriter",
      accept: {
        "application/pdf": [".pdf"],
        "application/msword": [".doc"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
        "text/plain": [".txt"],
        "text/html": [".html", ".htm"],
      },
    },
  ],
};

export const KNEXWRITER_RECENT_DOCUMENTS_STORAGE_KEY = "knexwriter_recent_documents_v1";
export const KNEXWRITER_MAX_RECENT_DOCUMENTS = 24;

export const ANALYSIS_KIND_LABEL = {
  literal_repetition: "Repetição literal",
  semantic_repetition: "Repetição semântica",
  redundancy: "Redundância",
  prolixity: "Prolixidade",
  incoherence: "Incoerência",
  contradiction: "Contradição",
  useful_recall: "Retomada útil",
  meaning_shift: "Deslocamento de sentido",
  low_argumentative_progression: "Baixa progressão argumentativa",
} as const;

export const OCCURRENCE_ROLE_LABEL = {
  primary: "Menção primária",
  secondary: "Menção secundária",
  tertiary: "Menção terciária",
  quaternary: "Menção quaternária",
  other: "Outra ocorrência",
} as const;

export const SEVERITY_LABEL = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
} as const;

export const SEVERITY_CLASS = {
  low: "border-sky-200 bg-sky-50 text-sky-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-rose-200 bg-rose-50 text-rose-700",
} as const;

export const WRITER_HEADER_TABS = [
  { value: "file", label: "Arquivo" },
  { value: "home", label: "Página Inicial" },
  { value: "insert", label: "Inserir" },
  { value: "design", label: "Design" },
  { value: "layout", label: "Layout" },
  { value: "references", label: "Referências" },
  { value: "mailings", label: "Correspondências" },
  { value: "review", label: "Revisão" },
  { value: "view", label: "Exibir" },
  { value: "help", label: "Ajuda" },
] as const;

