// components/Countdown.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

/** 12 horas em milissegundos */
export const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

/** Helper para obter uma data H horas à frente (padrão: 12h) */
export function hoursFromNow(h: number = 12): Date {
  const d = new Date();
  d.setHours(d.getHours() + h);
  return d;
}

/** Rótulos padrão (exportado caso queira reusar em outra UI) */
export const COUNTDOWN_LABELS = {
  hours: "HORAS",
  minutes: "MIN",
  seconds: "SEG",
};

type Props = {
  /** Data-alvo. Se não informado, usa hours (12 por padrão). */
  to?: Date;
  /** Número de horas para o alvo quando `to` não é passado. */
  hours?: number;
  /** Classe Tailwind extra */
  className?: string;
  /** Se true, mostra “--” até hidratar (evita mismatch). */
  showPlaceholders?: boolean;
};

export default function Countdown({
  to,
  hours = 12,
  className,
  showPlaceholders = true,
}: Props) {
  // Data-alvo calculada apenas uma vez (evita divergência SSR/CSR)
  const target = useMemo<Date>(() => to ?? hoursFromNow(hours), [to, hours]);

  // Evita hydration mismatch: só começa a “andar” após montar no cliente
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Enquanto não montou, mostra placeholders (ou nada, se desativado)
  if (!now) {
    return (
      <div className={["flex items-center gap-4", className].join(" ")}>
        <Box label={COUNTDOWN_LABELS.hours} value={showPlaceholders ? "--" : ""} />
        <span className="text-xl md:text-2xl -mt-1">:</span>
        <Box label={COUNTDOWN_LABELS.minutes} value={showPlaceholders ? "--" : ""} />
        <span className="text-xl md:text-2xl -mt-1">:</span>
        <Box label={COUNTDOWN_LABELS.seconds} value={showPlaceholders ? "--" : ""} />
      </div>
    );
  }

  const diff = Math.max(0, target.getTime() - now.getTime());
  const total = Math.floor(diff / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return (
    <div className={["flex items-center gap-4", className].join(" ")}>
      <Box label={COUNTDOWN_LABELS.hours} value={pad2(h)} />
      <span className="text-xl md:text-2xl -mt-1">:</span>
      <Box label={COUNTDOWN_LABELS.minutes} value={pad2(m)} />
      <span className="text-xl md:text-2xl -mt-1">:</span>
      <Box label={COUNTDOWN_LABELS.seconds} value={pad2(s)} />
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center" suppressHydrationWarning>
      <div className="text-2xl md:text-3xl font-extrabold tabular-nums">
        {value}
      </div>
      <div className="text-[10px] md:text-[11px] tracking-wide text-white/80 mt-1">
        {label}
      </div>
    </div>
  );
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}
