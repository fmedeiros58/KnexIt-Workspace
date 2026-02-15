import Link from "next/link";

type Highlight = {
  title: string;
  desc: string;
};

type ResourceLayoutProps = {
  badge?: string;
  title: string;
  subtitle: string;
  intro: string;
  highlights?: Highlight[];
  backHref?: string;
  backLabel?: string;
};

export default function ResourceLayout({
  badge = "Recursos",
  title,
  subtitle,
  intro,
  highlights = [],
  backHref = "/lobby",
  backLabel = "Voltar para o lobby",
}: ResourceLayoutProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-wide text-indigo-600 font-semibold">{badge}</p>
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          <p className="text-lg text-slate-700">{subtitle}</p>
          <p className="text-slate-700">{intro}</p>
        </div>

        {highlights.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {highlights.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-2 text-slate-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div>
          <Link href={backHref} className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm">
            {backLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
