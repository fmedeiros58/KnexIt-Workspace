type LandingIncludedProps = {
  title: string;
  description: string;
  highlights: string[];
};

export default function LandingIncluded({
  title,
  description,
  highlights,
}: LandingIncludedProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-16">
      <div className="mx-auto max-w-3xl text-center md:mx-0 md:text-left">
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm text-slate-600">{description}</p>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {highlights.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h3 className="text-base font-semibold text-slate-900">{item}</h3>
            <p className="mt-2 text-sm text-slate-600">
              Construa uma experiência consistente dentro do ecossistema KnexIT,
              com foco no que realmente importa.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
