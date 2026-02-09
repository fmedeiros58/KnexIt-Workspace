type LandingDemoProps = {
  title: string;
  description: string;
};

export default function LandingDemo({ title, description }: LandingDemoProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-16">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
        <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
            <p className="mt-3 text-sm text-slate-600">{description}</p>
          </div>
          <div className="rounded-2xl bg-[#f7f9fc] p-6 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Demonstra??o r?pida</p>
            <p className="mt-2">
              Inclua aqui capturas reais, fluxos do produto e um v?deo curto de
              como a equipe trabalha no dia a dia.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
