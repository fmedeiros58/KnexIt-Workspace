import ProductAppLink from "./ProductAppLink";
import Link from "next/link";

type LobbyProps = {
  slug: string;
  title: string;
  category?: string;
  headline: string;
  intro: string;
  problems?: string[];
  features?: string[];
  audiences?: string[];
  ctaLabel?: string;
};

export default function ProductLobby({
  slug,
  title,
  category = "Produto",
  headline,
  intro,
  problems = [],
  features = [],
  audiences = [],
  ctaLabel,
}: LobbyProps) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-12 space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">{category}</p>
          <h1 className="text-3xl md:text-4xl font-bold">{title}</h1>
          <p className="text-lg text-slate-700">{headline}</p>
          <p className="text-base text-slate-600 max-w-3xl">{intro}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ProductAppLink slug={slug} label={ctaLabel ?? "Acessar produto"} />
            <Link
              href="/knexit-workspace"
              className="inline-flex rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              Voltar ao KnexIT Workspace
            </Link>
          </div>
        </header>

        {problems.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-slate-900">O que resolve</h2>
            <ul className="list-disc space-y-2 pl-5 text-slate-700">
              {problems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {features.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-slate-900">Principais recursos</h2>
            <ul className="list-disc space-y-2 pl-5 text-slate-700">
              {features.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {audiences.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-slate-900">Para quem é</h2>
            <ul className="list-disc space-y-2 pl-5 text-slate-700">
              {audiences.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
