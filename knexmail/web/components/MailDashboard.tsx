"use client";

type Props = {
  stats: {
    todaySent: number;
    monthSent: number;
    successRate: number;
    byOrigin: { label: string; value: number }[];
  };
};

export default function MailDashboard({ stats }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card label="Enviados hoje" value={stats.todaySent} />
        <Card label="Enviados no mês" value={stats.monthSent} />
        <Card label="Taxa de sucesso" value={`${(stats.successRate * 100).toFixed(1)}%`} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="text-sm font-semibold text-slate-900 mb-2">E-mails por origem</div>
        <div className="flex flex-wrap gap-2 text-sm text-slate-700">
          {stats.byOrigin.map((o) => (
            <span key={o.label} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
              {o.label} <span className="text-slate-500">{o.value}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

