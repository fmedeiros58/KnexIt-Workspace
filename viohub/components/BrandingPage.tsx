import Link from "next/link";
import ProductAppLink from "./ProductAppLink";

type FeatureCard = { title: string; body: string };
type DemoSection = { title: string; lines: string[] };

type DemoCard = {
  title: string;
  statusLabel?: string;
  statusTone?: "green" | "indigo" | "amber";
  sections: DemoSection[];
};

type BrandingPageProps = {
  slug: string;
  chips?: string[];
  heroTitle: string;
  heroDescription: string;
  featureCards: FeatureCard[];
  benefits: string[];
  demo?: DemoCard;
  ctaLabel?: string;
};

const toneClass: Record<NonNullable<DemoCard["statusTone"]>, string> = {
  green: "bg-emerald-50 text-emerald-700",
  indigo: "bg-indigo-50 text-indigo-700",
  amber: "bg-amber-50 text-amber-700",
};

export default function BrandingPage({
  slug,
  chips = [],
  heroTitle,
  heroDescription,
  featureCards,
  benefits,
  demo,
  ctaLabel,
}: BrandingPageProps) {
  return (
    <main className="bg-white text-slate-900">
      <section className="bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-16 pt-12 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="space-y-4 md:w-1/2">
            {chips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-slate-600">
                {chips.map((app) => (
                  <span key={app} className="rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-sm border border-slate-200">
                    {app}
                  </span>
                ))}
              </div>
            )}
            <h1 className="text-3xl md:text-4xl font-bold leading-tight text-slate-900">{heroTitle}</h1>
            <p className="text-lg text-slate-700">{heroDescription}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="#cta" className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold shadow-sm">
                Fale com o time
              </Link>
              <Link
                href="/knexit-workspace#planos"
                className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 px-6 py-3 rounded-xl font-semibold"
              >
                Ver planos
              </Link>
            </div>
          </div>

          <div className="md:w-1/2">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">{demo?.title ?? "Pipeline de entrega"}</div>
                {demo?.statusLabel && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      demo.statusTone ? toneClass[demo.statusTone] : "bg-orange-50 text-orange-700"
                    }`}
                  >
                    {demo.statusLabel}
                  </span>
                )}
              </div>
              {demo?.sections.map((sec) => (
                <div key={sec.title} className="rounded-2xl border border-slate-200 bg-orange-50/60 p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-900">{sec.title}</p>
                  {sec.lines.map((l, idx) => (
                    <p key={idx} className="text-sm text-slate-700 leading-relaxed">
                      {l}
                    </p>
                  ))}
                </div>
              ))}
              {!demo && (
                <div className="rounded-2xl border border-slate-200 bg-orange-50/60 p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-900">Em breve</p>
                  <p className="text-sm text-slate-700">Exemplo interativo do pipeline do VioHub será exibido aqui.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="space-y-3 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Pensado para o ecossistema KnexIT</h2>
          <p className="text-lg text-slate-600">Integração com aulas, arquivos, IA e fluxos de publicação.</p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {featureCards.map((card) => (
            <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition">
              <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-12">
        <div className="mx-auto max-w-6xl px-4 md:px-6 grid gap-6 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-slate-900">Recursos principais</h2>
            <ul className="space-y-3 text-sm text-slate-700">
              {benefits.map((b) => (
                <li key={b} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-orange-500" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg space-y-3">
            <p className="text-sm font-semibold text-slate-900">Pronto para iniciar?</p>
            <p className="text-sm text-slate-700">
              Conecte-se com o time para alinhar necessidades ou acesse diretamente o produto com sua conta KnexIT.
            </p>
            <ProductAppLink slug={slug} label={ctaLabel ?? "Acessar produto"} />
          </div>
        </div>
      </section>

      <section id="cta" className="py-14 bg-white">
        <div className="mx-auto max-w-4xl text-center space-y-4">
          <h2 className="text-3xl font-bold text-slate-900">Pronto para usar?</h2>
          <p className="text-lg text-slate-600">
            Fale com o time ou acesse direto com sua conta KnexIT. Integrações e autenticação já configuradas.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="mailto:contato@exemplo.com" className="rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-500">
              Falar com o time
            </Link>
            <Link
              href="/knexit-workspace#planos"
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-50"
            >
              Ver planos
            </Link>
            <ProductAppLink slug={slug} label={ctaLabel ?? "Acessar produto"} />
          </div>
        </div>
      </section>
    </main>
  );
}
