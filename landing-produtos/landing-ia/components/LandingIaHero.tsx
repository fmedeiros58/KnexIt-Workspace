// Landing Page: landing-ia

type HeroProps = {
  title: string;
  description: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  videoTitle: string;
  videoSrc: string;
};

export default function LandingIaHero({
  title,
  description,
  primaryCta,
  secondaryCta,
  videoTitle,
  videoSrc,
}: HeroProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-12 pt-12">
      <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            {description}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={primaryCta.href} className="btn btn-primary no-underline">
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
        <div className="w-full max-w-[520px] rounded-[32px] bg-[#1f2226] p-3 shadow-xl lg:ml-auto">
          <div className="aspect-video overflow-hidden rounded-[22px] bg-black">
            <iframe
              src={videoSrc}
              title={videoTitle}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </section>
  );
}
