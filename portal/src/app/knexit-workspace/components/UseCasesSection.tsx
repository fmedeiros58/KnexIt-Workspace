const USE_CASES = [
  {
    title: "Universidades e pos-graduacoes",
    body: "Organize cursos, seminarios e laboratorios com VioClass, VioLive, SupaDrive, VioRead e KnexReview.",
  },
  {
    title: "Escolas tecnicas e EPT",
    body: "Planeje aulas praticas, projetos e avaliacao continua com fluxos no KnexFlow e materiais no SupaDrive.",
  },
  {
    title: "Secretarias e redes de ensino",
    body: "Padronize trilhas de aprendizagem, acompanhe escolas e turmas e dissemine conteudos com governanca.",
  },
  {
    title: "Grupos de pesquisa e labs",
    body: "Monte revisoes sistematicas, leia artigos com apoio de IA e compartilhe dados e resultados em equipe.",
  },
];

export default function UseCasesSection() {
  return (
    <section className="bg-slate-50 py-12">
      <div className="mx-auto max-w-6xl space-y-6 px-4 md:px-6">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Para quem e o KnexIT Workspace?</h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            De docentes individuais a grandes redes, a suite se adapta ao porte e ao tipo de operacao educacional.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {USE_CASES.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
            >
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
