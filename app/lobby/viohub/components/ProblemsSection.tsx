import { content } from "./content";

export default function ProblemsSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">O que o VioHub resolve</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {content.problems.map((item) => (
            <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-sm">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
