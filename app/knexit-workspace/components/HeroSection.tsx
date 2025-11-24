"use client";

const PRODUCT_ICONS = [
  { name: "VioClass", color: "bg-indigo-100", href: "/vioclass" },
  { name: "VioLive", color: "bg-emerald-100", href: "/violive" },
  { name: "SupaDrive", color: "bg-amber-100", href: "/supadrive" },
  { name: "VioRead", color: "bg-sky-100", href: "/vioread" },
  { name: "KnexReview", color: "bg-rose-100", href: "/knexreview" },
  { name: "KnexDocs", color: "bg-fuchsia-100", href: "/knexdocs" },
  { name: "KnexAI", color: "bg-slate-200", href: "/knexai" },
  { name: "KnexMail", color: "bg-lime-100", href: "/knexmail" },
];

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-emerald-50">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="absolute -right-10 top-10 h-56 w-56 rounded-full bg-emerald-200/40 blur-3xl" />
      </div>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 md:flex-row md:items-center md:gap-16 md:px-6">
        <div className="max-w-2xl space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">KnexIT Workspace</p>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            Veja sua instituição ir mais longe com o KnexIT Workspace
          </h1>
          <p className="text-lg text-slate-700">
            Suíte única para aulas, lives, arquivos, IA, comunicação e organização. Conecte turmas, conteúdos e equipes em um só lugar.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#contato" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-500">
              Fale com o time
            </a>
            <a href="#planos" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-indigo-700 ring-2 ring-indigo-100 hover:bg-indigo-50">
              Começar agora
            </a>
          </div>
        </div>

        <div className="grid w-full max-w-lg grid-cols-2 gap-3 md:grid-cols-3">
          {PRODUCT_ICONS.map((p) => (
            <a
              key={p.name}
              href={p.href}
              className="group rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm hover:-translate-y-1 hover:shadow-md transition"
            >
              <div className={`mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl ${p.color} text-sm font-bold text-slate-900`}>
                {p.name.slice(0, 2)}
              </div>
              <div className="text-sm font-semibold text-slate-900">{p.name}</div>
              <div className="text-xs text-slate-500">Parte da suíte KnexIT</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

