const resources = [
  {
    tag: "Evento",
    title: "IA em ação: práticas para times de alta performance",
    cta: "Saiba mais",
  },
  {
    tag: "Guia",
    title: "Introdução a prompts eficientes para equipes",
    cta: "Baixar guia",
  },
  {
    tag: "E-book",
    title: "Como estruturar uma operação com IA no dia a dia",
    cta: "Ver agora",
  },
];

export default function LandingResources() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-16">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold text-slate-900">Recursos</h2>
        <p className="mt-3 text-sm text-slate-600">
          Conteúdos para ajudar sua equipe a aplicar IA com consistência.
        </p>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {resources.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {item.tag}
            </p>
            <h3 className="mt-2 text-base font-semibold text-slate-900">
              {item.title}
            </h3>
            <button
              type="button"
              className="mt-4 text-sm font-semibold text-[#2f66ff]"
            >
              {item.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
