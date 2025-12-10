export default function SuportePremiumPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
        <div>
          <p className="text-sm uppercase tracking-wide text-indigo-600 font-semibold">Suporte premium</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-2">Atendimento dedicado para sua operação</h1>
          <p className="mt-3 text-slate-600">
            SLA estendido, canal direto com especialistas e gestão de incidentes priorizada. Tenha suporte alinhado às janelas
            críticas de aulas, provas e eventos.
          </p>
        </div>
        <div className="grid gap-4 text-sm text-slate-700">
          <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Canais dedicados</h2>
            <p className="mt-2 text-slate-600">Suporte via chat, e-mail e ponte direta com especialistas de produto.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">SLA estendido</h2>
            <p className="mt-2 text-slate-600">Priorização de tickets, horários combinados e relatórios de performance.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Gestão de incidentes</h2>
            <p className="mt-2 text-slate-600">Planos de ação, comunicação rápida e prevenção contínua.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
