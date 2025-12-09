export default function IntegracoesPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
        <div>
          <p className="text-sm uppercase tracking-wide text-indigo-600 font-semibold">Integrações</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-2">APIs, SSO e conectores prontos</h1>
          <p className="mt-3 text-slate-600">
            Conecte o ecossistema KnexIT ao que sua instituição já usa. Disponibilizamos APIs, SSO, webhooks e conectores para
            SIS, LMS, e-mail, pagamentos e analytics.
          </p>
        </div>
        <div className="grid gap-4 text-sm text-slate-700">
          <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">SSO e identidade</h2>
            <p className="mt-2 text-slate-600">SAML, OAuth2 e provisionamento automatizado de usuários.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">APIs e webhooks</h2>
            <p className="mt-2 text-slate-600">Eventos em tempo real para fluxos acadêmicos e operacionais.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Conectores prontos</h2>
            <p className="mt-2 text-slate-600">Integrações com LMS, CRM, pagamento e ferramentas analíticas.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
