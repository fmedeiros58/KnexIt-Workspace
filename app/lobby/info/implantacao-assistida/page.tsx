export default function ImplantacaoAssistidaPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
        <div>
          <p className="text-sm uppercase tracking-wide text-indigo-600 font-semibold">Implantação assistida</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-2">Onboarding guiado para sua equipe</h1>
          <p className="mt-3 text-slate-600">
            Conte com acompanhamento dedicado para configurar ambientes, usuários, integrações e boas práticas. Nosso time conduz
            sessões hands-on para garantir que cada área use bem os produtos do ecossistema KnexIT.
          </p>
        </div>
        <div className="grid gap-4 text-sm text-slate-700">
          <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Checklist inicial</h2>
            <p className="mt-2 text-slate-600">Provisionamento de usuários, políticas de acesso, templates e fluxos principais.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Treinamento por perfil</h2>
            <p className="mt-2 text-slate-600">Workshops para professores, coordenação, TI e suporte interno.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Acompanhamento</h2>
            <p className="mt-2 text-slate-600">Metas semanais, sessões de dúvidas e plano de adoção com resultados rastreáveis.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
