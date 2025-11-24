"use client";

import type { PrismaCounts } from "@/lib/knexreview/types";

type Props = {
  counts: PrismaCounts;
};

export default function PrismaFlowSummary({ counts }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-sm font-semibold text-slate-900 mb-2">Resumo PRISMA</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Card label="Identificados" value={counts.identified} />
        <Card label="Após dedup" value={counts.afterDedup} />
        <Card label="Após screening" value={counts.afterScreening} />
        <Card label="Incluídos" value={counts.included} />
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

