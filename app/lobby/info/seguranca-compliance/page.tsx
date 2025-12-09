export default function SegurancaCompliancePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
        <div>
          <p className="text-sm uppercase tracking-wide text-indigo-600 font-semibold">Segurança e compliance</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-2">Governança, auditoria e LGPD em dia</h1>
          <p className="mt-3 text-slate-600">
            Configure políticas de segurança, retenção, auditoria e SSO para manter dados protegidos e aderentes a normas locais.
            Ajudamos a alinhar práticas de segurança com times jurídicos e de TI.
          </p>
        </div>
        <div className="grid gap-4 text-sm text-slate-700">
          <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Controles de acesso</h2>
            <p className="mt-2 text-slate-600">Perfis, grupos, MFA e políticas de compartilhamento por papel e unidade.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Auditoria e trilhas</h2>
            <p className="mt-2 text-slate-600">Logs de atividade, alertas e relatórios para times de segurança e compliance.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">LGPD e dados</h2>
            <p className="mt-2 text-slate-600">Processos de consentimento, retenção e descarte alinhados às suas políticas.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
