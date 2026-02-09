type LandingUseCasesProps = {
  title: string;
  description: string;
};

const useCases = [
  {
    title: "Vendas",
    body: "Automatize tarefas e entregue apresenta??es personalizadas com rapidez.",
  },
  {
    title: "Marketing",
    body: "Gere campanhas consistentes e aproveite insights em tempo real.",
  },
  {
    title: "Atendimento",
    body: "Respostas r?pidas com contexto e hist?rico de cada cliente.",
  },
  {
    title: "Recursos humanos",
    body: "Onboarding ?gil, materiais escal?veis e comunica??o clara.",
  },
  {
    title: "Projetos",
    body: "Planejamento, execu??o e acompanhamento em uma vis?o ?nica.",
  },
];

export default function LandingUseCases({
  title,
  description,
}: LandingUseCasesProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-16">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm text-slate-600">{description}</p>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {useCases.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
