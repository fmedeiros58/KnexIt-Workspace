export default function HowItWorksSection() {
  const steps = [
    {
      title: "Centralize aulas, turmas e materiais",
      body: "Use VioClass para aulas e trilhas e armazene apostilas, slides e provas no SupaDrive com pastas por turma.",
    },
    {
      title: "Conecte aulas ao vivo, gravacoes e interacoes",
      body: "VioLive para encontros ao vivo, VioRecord para gravar, e KnexChat para manter conversas e avisos organizados.",
    },
    {
      title: "Ative IA para leitura, revisao e busca",
      body: "VioRead, KnexReview e KnexAI ajudam a traduzir, resumir e triar artigos; KnexSearch encontra conteudos em poucos cliques.",
    },
    {
      title: "Acompanhe resultados e ajuste caminhos",
      body: "VioAnalytics mostra engajamento em video, KnexFlow organiza tarefas e fluxos, e os times tomam decisoes com dados.",
    },
  ];

  return (
    <section className="bg-white py-12">
      <div className="mx-auto max-w-6xl space-y-6 px-4 md:px-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-slate-900">Como o KnexIT Workspace se encaixa no seu dia a dia</h2>
          <p className="text-lg text-slate-600">
            Fluxo simples para criar, transmitir, organizar e analisar conteudos em uma unica suite, com IA apoiando cada
            etapa.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {steps.map((step) => (
            <div
              key={step.title}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
            >
              <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
