type Cta = { label: string; href: string };

type LandingHeroProps = {
  badge: string;
  title: string;
  subtitle: string;
  primaryCta: Cta;
  secondaryCta: Cta;
};

export default function LandingHero({
  badge,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
}: LandingHeroProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-10 pt-14">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          <span className="rounded-full bg-white px-3 py-1 shadow-sm">{badge}</span>
          <span>KnexIT Workspace</span>
        </div>
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={primaryCta.href}
            className="rounded-full bg-[#2f66ff] px-5 py-2 text-sm font-semibold text-white no-underline shadow-sm"
          >
            {primaryCta.label}
          </a>
          <a
            href={secondaryCta.href}
            className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 no-underline"
          >
            {secondaryCta.label}
          </a>
        </div>
      </div>
    </section>
  );
}
