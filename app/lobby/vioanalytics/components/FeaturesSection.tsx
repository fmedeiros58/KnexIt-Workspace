import { content } from "./content";

export default function FeaturesSection() {
  if (!content.features?.length) return null;

  return (
    <section className="bg-slate-50 py-12">
      <div className="mx-auto max-w-6xl px-4 md:px-6 space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-slate-900">Principais recursos</h2>
          <p className="text-sm text-slate-600">Destaques que você encontra no produto.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {content.features.map((f) => (
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
  );
}

