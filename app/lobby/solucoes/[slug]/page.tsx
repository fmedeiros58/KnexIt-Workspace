import Link from "next/link";

const PAGES: Record<string, { title: string; subtitle: string; body: string; back?: string }> = {
  "visao-geral-individuos": {
    title: "Visão geral - Individuais",
    subtitle: "Workspace ajustado para uso pessoal e micro iniciativas.",
    body: "Comece com o básico de colaboração, armazenamento e comunicação em um ambiente simples de configurar.",
  },
  "visao-geral-pmes": {
    title: "Visão geral - PMEs",
    subtitle: "Produtividade e organização para pequenas e médias empresas.",
    body: "Combine arquivos, comunicação e fluxos para equipes enxutas com governança leve.",
  },
  "visao-geral-enterprise": {
    title: "Visão geral - Grandes empresas",
    subtitle: "Escala, segurança e governança para operações amplas.",
    body: "Inclui fluxos avançados, auditoria e integrações profundas com seus sistemas.",
  },
  "pequenas-empresas": {
    title: "Pequenas empresas",
    subtitle: "Produtividade e colaboração para times menores.",
    body: "Modelos prontos, armazenamento seguro e comunicação integrada.",
  },
  "novas-empresas": {
    title: "Novas empresas",
    subtitle: "Arranque rápido com fluxos pré-configurados.",
    body: "Implemente projetos, tarefas e comunicação em poucos passos.",
  },
  startups: {
    title: "Startups",
    subtitle: "Ferramentas enxutas para crescer rápido.",
    body: "Automatize rotinas, organize conhecimento e ganhe velocidade nas entregas.",
  },
  "equipe-atendimento": {
    title: "Equipe de atendimento",
    subtitle: "Fluxos dedicados para suporte e operações.",
    body: "Roteie demandas, registre interações e mantenha o time alinhado.",
  },
  "work-safer": {
    title: "Work Safer",
    subtitle: "Segurança reforçada e governança.",
    body: "Proteção avançada, auditoria e políticas detalhadas para grandes operações.",
  },
  desenvolvedores: {
    title: "Desenvolvedores",
    subtitle: "Recursos para criar e integrar com o ecossistema.",
    body: "APIs, webhooks e guias para construir experiências conectadas.",
  },
  educacao: {
    title: "Educação",
    subtitle: "Soluções para ensino, pesquisa e gestão acadêmica.",
    body: "Fluxos para aulas, provas, extensão e colaboração entre docentes e alunos.",
  },
  "organizacoes-sem-fins-lucrativos": {
    title: "Organizações sem fins lucrativos",
    subtitle: "Ferramentas para impacto social e gestão eficiente.",
    body: "Coordene voluntários, comunicações e documentação em um só lugar.",
  },
};

export default function SolucoesSlugPage({ params }: { params: { slug: string } }) {
  const page = PAGES[params.slug];
  if (!page) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-12 space-y-4">
          <h1 className="text-2xl font-bold">Página não encontrada</h1>
          <p className="text-slate-600">O conteúdo solicitado ainda não foi configurado.</p>
          <Link href="/lobby" className="text-indigo-600 hover:text-indigo-700">
            Voltar para o lobby
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-4xl px-6 py-12 space-y-4">
        <p className="text-sm uppercase tracking-wide text-indigo-600 font-semibold">Soluções</p>
        <h1 className="text-3xl font-bold text-slate-900">{page.title}</h1>
        <p className="text-lg text-slate-700">{page.subtitle}</p>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-700">{page.body}</p>
        </div>
        <Link href="/lobby" className="text-indigo-600 hover:text-indigo-700">
          Voltar para o lobby
        </Link>
      </div>
    </main>
  );
}
