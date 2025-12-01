import { content } from "./content";

export default function AudienceSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Para quem é</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {content.audiences.map((audience) => (
            <div key={audience} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-sm">
              {audience}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
