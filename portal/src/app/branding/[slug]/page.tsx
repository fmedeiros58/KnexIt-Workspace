type BrandingInfo = {
  name: string;
  tagline: string;
  summary: string;
  bullets: string[];
  accent: string;
};

const BRANDS: Record<string, BrandingInfo> = {
  vioclass: {
    name: "VioClass",
    tagline: "Sua sala de aula digital, com trilhas e turmas.",
    summary: "Hospede e organize videoaulas, módulos e provas em um ambiente pensado para cursos completos.",
    bullets: ["Player com capítulos e downloads controlados", "Turmas, trilhas e certificados", "Relatórios de progresso e conclusão"],
    accent: "from-indigo-500 to-sky-500",
  },
  violive: {
    name: "VioLive",
    tagline: "Transmissões ao vivo com interação e gravação.",
    summary: "Lives, mentorias e aulas síncronas com registro automático e chat moderado.",
    bullets: ["Agenda de lives e links rápidos", "Chat moderado e enquetes", "Gravação automática no SupaDrive"],
    accent: "from-rose-500 to-orange-500",
  },
  viorecord: {
    name: "VioRecord",
    tagline: "Grave tela, webcam e áudio direto do navegador.",
    summary: "Capte aulas, tutoriais ou demonstrações sem instalar nada, salvando no SupaDrive.",
    bullets: ["Captura de tela + câmera + microfone", "Recortes rápidos e exportação", "Integração imediata com SupaDrive"],
    accent: "from-red-500 to-amber-500",
  },
  viostudio: {
    name: "VioStudio",
    tagline: "Edição online com cortes, legendas e sobreposições.",
    summary: "Finalize suas aulas com ajustes rápidos, remoção de trechos e legendas automáticas.",
    bullets: ["Cortes não destrutivos", "Legenda e ajustes de áudio", "Exportação pronta para VioClass"],
    accent: "from-red-600 to-pink-500",
  },
  vioanalytics: {
    name: "VioAnalytics",
    tagline: "Métricas de engajamento e retenção em vídeo.",
    summary: "Monitore visualizações, drop-off e conclusão para otimizar suas aulas e lives.",
    bullets: ["Visão de funil e retenção", "Heatmaps de atenção", "Alertas de queda e exportação de CSV"],
    accent: "from-cyan-600 to-blue-500",
  },
  supadrive: {
    name: "SupaDrive",
    tagline: "Drive acadêmico para aulas, provas e materiais.",
    summary: "Armazene, compartilhe e versiona materiais com permissões simples para turmas e times.",
    bullets: ["Pastas por turma e disciplina", "Links seguros e expiráveis", "Versionamento leve e buscas rápidas"],
    accent: "from-blue-600 to-sky-500",
  },
  knexdocs: {
    name: "KnexDocs",
    tagline: "Docs colaborativos em tempo real.",
    summary: "Produza e edite documentos com coautoria, comentários e histórico.",
    bullets: ["Coedição em tempo real", "Comentários e sugestões", "Histórico e restauração rápida"],
    accent: "from-sky-600 to-indigo-500",
  },
  knexflow: {
    name: "KnexFlow",
    tagline: "Quadros de tarefas para equipes e turmas.",
    summary: "Organize demandas, responsáveis e prazos com quadros kanban e automações leves.",
    bullets: ["Quadros por turma/projeto", "Checklists e prazos", "Automação simples por status"],
    accent: "from-emerald-600 to-teal-500",
  },
  knexchat: {
    name: "KnexChat",
    tagline: "Mensageria interna para equipes e alunos.",
    summary: "Canais, DMs e arquivos em um só lugar, com busca rápida e notificações.",
    bullets: ["Canais temáticos e DMs", "Compartilhamento de arquivos", "Busca por mensagens e anexos"],
    accent: "from-teal-600 to-cyan-500",
  },
  knexsearch: {
    name: "KnexSearch",
    tagline: "Busca global com IA em aulas e arquivos.",
    summary: "Encontre trechos de vídeo, PDFs e docs com contexto e respostas diretas.",
    bullets: ["Busca semântica em vídeo e texto", "Respostas com referências", "Filtros por turma e tipo de conteúdo"],
    accent: "from-purple-600 to-violet-500",
  },
  vioread: {
    name: "VioRead",
    tagline: "Leitura assistida de PDFs e artigos.",
    summary: "Leia, destaque e peça resumos ou perguntas para IA direto no leitor.",
    bullets: ["Anotações e destaques", "Resumos e flashcards com IA", "Leitura em voz e acessibilidade"],
    accent: "from-indigo-600 to-blue-500",
  },
  knexreview: {
    name: "KnexReview",
    tagline: "Revisão sistemática de literatura com IA.",
    summary: "Gerencie bases, extraia achados e organize evidências com trilhas revisáveis.",
    bullets: ["Triagem assistida por IA", "Extração de dados e quadros", "Histórico de decisões e rastreabilidade"],
    accent: "from-emerald-600 to-lime-500",
  },
  knexai: {
    name: "KnexAI",
    tagline: "Camada unificada de IA para seu workspace.",
    summary: "Assistentes contextuais para aulas, docs, tarefas e mensagens.",
    bullets: ["Prompts prontos por fluxo", "Contexto seguro por turma", "Logs e controles de uso"],
    accent: "from-fuchsia-600 to-pink-500",
  },
  knexmail: {
    name: "KnexMail",
    tagline: "Envios transacionais e campanhas para educação.",
    summary: "Dispare convites, lembretes e newsletters segmentadas por turma ou trilha.",
    bullets: ["Templates por evento acadêmico", "Segmentação e testes A/B", "Relatórios de entrega e abertura"],
    accent: "from-blue-600 to-indigo-600",
  },
  knexpay: {
    name: "KnexPay",
    tagline: "Billing integrado para cursos e matrículas.",
    summary: "Planos, cobranças e conciliação com foco em escolas e edtechs.",
    bullets: ["Planos e cupons", "Cobrança recorrente", "Relatórios financeiros simplificados"],
    accent: "from-slate-700 to-slate-500",
  },
};

export default function BrandingPage({ params }: { params: { slug: string } }) {
  const brand = BRANDS[params.slug];

  if (!brand) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-16 space-y-4 text-center">
          <h1 className="text-3xl font-bold">Página em construção</h1>
          <p className="text-slate-600">Ainda estamos preparando esta página de branding. Volte em breve.</p>
          <a href="/knexit-workspace#produtos" className="text-indigo-600 hover:underline">
            Voltar aos produtos
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="relative overflow-hidden border-b border-slate-200">
        <div className={`absolute inset-0 bg-gradient-to-r ${brand.accent} opacity-10`} />
        <div className="relative mx-auto max-w-5xl px-4 py-14 space-y-6">
          <a href="/knexit-workspace#produtos" className="text-sm text-indigo-600 hover:underline">
            ← Voltar para os produtos
          </a>
          <div className="inline-flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-2 shadow-sm ring-1 ring-slate-200">
            <span className="h-10 w-10 rounded-xl bg-gradient-to-br from-white to-slate-100 shadow-inner" />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Branding preview</p>
              <p className="text-lg font-semibold text-slate-900">{brand.name}</p>
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-slate-900">{brand.tagline}</h1>
            <p className="text-lg text-slate-700 max-w-3xl">{brand.summary}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {brand.bullets.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">{item}</div>
              </div>
            ))}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Identidade visual</h2>
            <p className="text-slate-700 text-sm">
              Sugestão de uso: aplicar gradiente {brand.accent.replace("from-", "de ").replace(" to-", " até ")} em fundos ou
              acentos, mantendo ícones em branco ou cor sólida contrastante. Use cantos arredondados e sombras leves para
              coerência com o dashboard.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
