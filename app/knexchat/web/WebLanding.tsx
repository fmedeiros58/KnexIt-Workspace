import Link from "next/link";

export default function WebLanding() {
  const problems = [
    "Centralizar conversas da equipe em um unico ambiente.",
    "Reduzir perda de contexto entre canais e grupos.",
    "Facilitar entrada rapida no chat web apos ativacao.",
  ];

  const features = [
    "Acesso direto ao chat web com fluxo de ativacao.",
    "Experiencia focada em mensagens, grupos e colaboracao.",
    "Base pronta para expansao com recursos do ecossistema KnexIT.",
  ];

  const audiences = [
    "Equipes de operacao e atendimento.",
    "Times internos que precisam de comunicacao continua.",
    "Usuarios do Workspace que usam o KnexChat no navegador.",
  ];

  return (
    <main className="bg-white text-slate-900">
      <section className="bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-16 pt-12 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="space-y-4 md:w-1/2">
            <div className="flex flex-wrap items-center gap-2 text-slate-600">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold shadow-sm">
                Chat web
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold shadow-sm">
                Ativacao concluida
              </span>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">Produto</p>
            <h1 className="text-3xl font-bold leading-tight text-slate-900 md:text-4xl">KnexChat</h1>
            <p className="text-lg text-slate-700">Converse e coordene equipes no ambiente web do KnexChat.</p>
            <p className="text-base text-slate-600">
              Esta pagina segue o padrao de lobby dos outros apps e serve como ponto de entrada para o chat.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/knexchat/web"
                className="inline-flex rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow hover:bg-indigo-500"
              >
                Acessar produto
              </Link>
              <Link
                href="/knexit-workspace"
                className="inline-flex rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-50"
              >
                Voltar ao Workspace
              </Link>
            </div>
          </div>

          <div className="md:w-1/2">
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Pronto para comecar</div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Disponivel</span>
              </div>
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-indigo-50/60 p-4 text-sm leading-relaxed text-slate-700">
                <p>Seu fluxo de ativacao finalizou e voce pode seguir para o ambiente de conversa.</p>
                <p className="font-semibold text-slate-900">Dica:</p>
                <p>Use o botao &quot;Acessar produto&quot; para abrir o endpoint web do KnexChat.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-slate-900">O que resolve</h2>
            <p className="text-sm text-slate-600">Principais pontos cobertos por este fluxo.</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {problems.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-slate-900">Para quem e</h2>
            <p className="text-sm text-slate-600">Publicos que mais se beneficiam.</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {audiences.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-12">
        <div className="mx-auto max-w-6xl space-y-6 px-4 md:px-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-slate-900">Principais recursos</h2>
            <p className="text-sm text-slate-600">Destaques do acesso web do KnexChat.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {features.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <h3 className="text-sm font-semibold text-slate-900">Recurso</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="cta" className="bg-white py-14">
        <div className="mx-auto max-w-4xl space-y-4 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Pronto para entrar no KnexChat?</h2>
          <p className="text-lg text-slate-600">Acesse o produto e continue no fluxo web do chat.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/knexchat/web"
              className="inline-flex rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow hover:bg-indigo-500"
            >
              Acessar produto
            </Link>
            <Link
              href="/knexit-workspace"
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-50"
            >
              Voltar ao Workspace
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
