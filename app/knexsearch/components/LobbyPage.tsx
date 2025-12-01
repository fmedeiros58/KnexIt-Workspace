import Link from "next/link";
import ProductAppLink from "./ProductAppLink";

type LobbyPageProps = {
  slug: string;
  title: string;
  headline: string;
  intro: string;
  problems: string[];
  features: string[];
  audiences: string[];
  chips?: string[];
  ctaLabel?: string;
};

export default function LobbyPage({
  slug,
  title,
  headline,
  intro,
  problems,
  features,
  audiences,
  chips = [],
  ctaLabel,
}: LobbyPageProps) {
  return (
    <main className="bg-white text-slate-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-16 pt-12 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="space-y-4 md:w-1/2">
            {chips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-slate-600">
                {chips.map((chip) => (
                  <span key={chip} className="rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-sm border border-slate-200">
                    {chip}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">Produto</p>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight text-slate-900">{title}</h1>
            <p className="text-lg text-slate-700">{headline}</p>
            <p className="text-base text-slate-600">{intro}</p>
            <div className="flex flex-wrap gap-3">
              <ProductAppLink slug={slug} label={ctaLabel ?? "Acessar produto"} />
              <Link href={`/branding/${slug}`} className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 px-6 py-3 rounded-xl font-semibold">
                Ver mais detalhes
              </Link>
            </div>
          </div>

          <div className="md:w-1/2">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Pronto para começar</div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Disponível</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-indigo-50/60 p-4 space-y-2 text-sm text-slate-700 leading-relaxed">
                <p>
                  Este lobby leva você ao produto completo. Verifique os benefícios abaixo, acesse com sua conta KnexIT e continue no ambiente autenticado.
                </p>
                <p className="font-semibold text-slate-900">Dica:</p>
                <p>Use o botão “Acessar produto” para entrar direto. Se não estiver logado, você será direcionado ao login.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* O que resolve */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-slate-900">O que resolve</h2>
            <p className="text-sm text-slate-600">Principais dores que este produto cobre.</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {problems.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-slate-900">Para quem é</h2>
            <p className="text-sm text-slate-600">Públicos-alvo que mais se beneficiam.</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {audiences.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Recursos principais */}
      <section className="bg-slate-50 py-12">
        <div className="mx-auto max-w-6xl px-4 md:px-6 space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-slate-900">Principais recursos</h2>
            <p className="text-sm text-slate-600">Destaques que você encontra no produto.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {features.map((f) => (
              <div
                key={f}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
              >
                <h3 className="text-sm font-semibold text-slate-900">Recurso</h3>
                <p className="mt-1 text-sm text-slate-700 leading-relaxed">{f}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section id="cta" className="py-14 bg-white">
        <div className="mx-auto max-w-4xl text-center space-y-4">
          <h2 className="text-3xl font-bold text-slate-900">Pronto para usar o {title}?</h2>
          <p className="text-lg text-slate-600">
            Acesse direto com sua conta KnexIT. Se precisar de mais detalhes de marketing, visite a página de branding.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <ProductAppLink slug={slug} label={ctaLabel ?? "Acessar produto"} />
            <Link
              href={`/branding/${slug}`}
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-50"
            >
              Ver branding
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
