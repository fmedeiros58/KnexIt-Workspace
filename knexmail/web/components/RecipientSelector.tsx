"use client";

type Props = {
  onChange: (cfg: any) => void;
};

export default function RecipientSelector({ onChange }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 space-y-2">
      <p className="text-xs text-slate-600">Público (mock): informe e-mails separados por vírgula.</p>
      <textarea
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        rows={2}
        onChange={(e) => {
          const emails = e.target.value
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          onChange({ emails });
        }}
        placeholder="email1@dominio.com, email2@dominio.com"
      />
    </div>
  );
}

