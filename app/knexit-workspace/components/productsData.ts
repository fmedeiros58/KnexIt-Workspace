export type WorkspaceProductCategory = "video" | "produtividade" | "ia" | "comunicacao" | "infra";

export type WorkspaceProduct = {
  id: string;
  name: string;
  slug: string;
  category: WorkspaceProductCategory;
  description: string;
  icon?: "play" | "record" | "edit" | "live" | "folder" | "supadrive" | "doc" | "read" | "kanban" | "chat" | "search" | "review" | "analytics" | "brain" | "owl" | "mail" | "credit" | "hub" | "pen";
};

export const WORKSPACE_PRODUCTS: WorkspaceProduct[] = [
  {
    id: "vioclass",
    name: "VioClass",
    slug: "vioclass",
    category: "video",
    description: "Plataforma de cursos e aulas em vídeo.",
    icon: "play",
  },
  {
    id: "violive",
    name: "VioLive",
    slug: "violive",
    category: "video",
    description: "Aulas ao vivo e mentorias síncronas.",
    icon: "live",
  },
  {
    id: "viorecord",
    name: "VioRecord",
    slug: "viorecord",
    category: "video",
    description: "Grave tela, webcam e voz no navegador.",
    icon: "record",
  },
  {
    id: "viostudio",
    name: "VioStudio",
    slug: "viostudio",
    category: "video",
    description: "Edição online de vídeo e legendas.",
    icon: "edit",
  },
  {
    id: "vioanalytics",
    name: "VioAnalytics",
    slug: "vioanalytics",
    category: "video",
    description: "Métricas de visualização e engajamento.",
    icon: "analytics",
  },
  {
    id: "viohub",
    name: "VioHub",
    slug: "viohub",
    category: "video",
    description: "Produção audiovisual integrada e entrega.",
    icon: "hub",
  },
  {
    id: "supadrive",
    name: "SupaDrive",
    slug: "supadrive",
    category: "produtividade",
    description: "Drive de arquivos para materiais e provas.",
    icon: "supadrive",
  },
  {
    id: "knexdocs",
    name: "KnexDocs",
    slug: "knexdocs",
    category: "produtividade",
    description: "Documentos colaborativos em tempo real.",
    icon: "doc",
  },
  {
    id: "knexflow",
    name: "KnexFlow",
    slug: "knexflow",
    category: "produtividade",
    description: "Tarefas, quadros e fluxos de trabalho.",
    icon: "kanban",
  },
  {
    id: "knexchat",
    name: "KnexChat",
    slug: "knexchat",
    category: "comunicacao",
    description: "Chat interno para times e turmas.",
    icon: "chat",
  },
  {
    id: "knexsearch",
    name: "KnexSearch",
    slug: "knexsearch",
    category: "ia",
    description: "Busca global com IA em aulas e arquivos.",
    icon: "search",
  },
  {
    id: "vioread",
    name: "VioRead",
    slug: "vioread",
    category: "produtividade",
    description: "Leitura assistida de PDFs e artigos.",
    icon: "read",
  },
  {
    id: "knexreview",
    name: "KnexReview",
    slug: "knexreview",
    category: "produtividade",
    description: "Revisão sistemática de literatura.",
    icon: "review",
  },
  {
    id: "knexai",
    name: "KnexAI",
    slug: "knexai",
    category: "ia",
    description: "Camada unificada de IA e assistentes.",
    icon: "owl",
  },
  {
    id: "knexmail",
    name: "KnexMail",
    slug: "knexmail",
    category: "comunicacao",
    description: "E-mails transacionais e campanhas.",
    icon: "mail",
  },
  {
    id: "knexpay",
    name: "KnexPay",
    slug: "knexpay",
    category: "infra",
    description: "Billing e planos em breve.",
    icon: "credit",
  },
  {
    id: "knexwriter",
    name: "KnexWriter",
    slug: "knexwriter",
    category: "ia",
    description: "Escrita assistida por IA com paginação.",
    icon: "pen",
  },
];

export const CATEGORY_LABEL: Record<WorkspaceProductCategory, string> = {
  video: "Vídeo",
  produtividade: "Produtividade",
  ia: "IA",
  comunicacao: "Comunicação",
  infra: "Infraestrutura",
};

export const PRODUCT_CARD_COLORS = [
  "#4338CA",
  "#047857",
  "#B45309",
  "#BE123C",
  "#0369A1",
  "#7C3AED",
  "#2563EB",
  "#15803D",
  "#C2410C",
  "#0EA5E9",
  "#9333EA",
  "#1D4ED8",
  "#065F46",
  "#B91C1C",
  "#0F766E",
];

export const PRODUCT_PANEL_SIDE_LINKS = [
  { label: "Soluções de IA", href: "/lobby/solucoes/desenvolvedores" },
  { label: "Segurança", href: "/lobby/info/seguranca-compliance" },
  { label: "Admin Console", href: "/admin/login" },
  { label: "Complementos", href: "/lobby/info/integracoes" },
  { label: "Ver mais apps", href: "/lobby" },
];
