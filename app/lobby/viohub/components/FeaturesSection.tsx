import { content } from "./content";

export default function FeaturesSection() {
  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-12 space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Principais recursos</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {content.features.map((feature) => (
            <div key={feature} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-700">
              {feature}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
