"use client";

type AccessFlowGuideProps = {
  step: 1 | 2 | 3;
  nextStep: string;
  activeLabel?: string;
};

const STEPS = [
  { id: 1, label: "E-mail" },
  { id: 2, label: "Senha" },
  { id: 3, label: "Código" },
] as const;

export default function AccessFlowGuide({ step, nextStep, activeLabel }: AccessFlowGuideProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3">
      <div className="grid w-full grid-cols-3 gap-2">
        {STEPS.map((item) => {
          const active = item.id === step;
          const done = item.id < step;
          const label = active && activeLabel ? activeLabel : item.label;
          return (
            <div
              key={item.id}
              className={`inline-flex w-full min-w-0 items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                active
                  ? "bg-[var(--kx-primary)] text-white"
                  : done
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              <span className="truncate whitespace-nowrap">
                {item.id}. {label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-600">
        <span className="font-semibold text-slate-700">Próximo passo:</span> {nextStep}
      </p>
    </div>
  );
}
