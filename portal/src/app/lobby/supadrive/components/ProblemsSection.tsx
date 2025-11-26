import { problems } from "./content";

export default function ProblemsSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold text-slate-900">O que resolve</h2>
        <p className="text-sm text-slate-600">Principais dores que o SupaDrive cobre.</p>
        <ul className="mt-2 space-y-2 text-sm text-slate-700">
          {problems.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
