const BENEFITS = [
  {
    title: "Tudo em um só lugar",
    body: "Aulas, lives, arquivos, documentos, tarefas e IA convivem na mesma suíte para evitar dispersão e silos.",
  },
  {
    title: "Foco em educação e pesquisa",
    body: "Pensado para escolas, universidades e laboratórios, com fluxos que respeitam o contexto acadêmico.",
  },
  {
    title: "IA aplicada à prática",
    body: "Leitura de artigos com VioRead, revisão com KnexReview, busca inteligente com KnexSearch e assistentes via KnexAI.",
  },
  {
    title: "Colaboração em tempo real",
    body: "KnexDocs, KnexChat e VioLive mantêm o time em sincronia com edição colaborativa e comunicação direta.",
  },
  {
    title: "Escalável do professor à rede",
    body: "Planos cobrem desde docentes individuais até grandes redes, com controle de acesso e governança.",
  },
  {
    title: "Pronto para crescer",
    body: "Integra KnexMail para notificações e KnexPay para cobrança futura, mantendo espaço para novas integrações.",
  },
];

export default function BenefitsSection() {
  return (
    <section className="bg-slate-50 py-12">
      <div className="mx-auto max-w-6xl space-y-6 px-4 md:px-6">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Por que escolher o KnexIT Workspace?</h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Suíte completa para ensino, pesquisa e colaboração com IA conectada aos seus conteúdos.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {BENEFITS.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                •
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
