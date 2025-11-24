import Link from "next/link";

export default function KnexPayPage() {
  const problems = [
    "Gerenciar planos, billing e cobranca conectados aos produtos do Workspace.",
    "Controlar limites de uso (storage, IA, lives) por assinatura.",
    "Evitar conciliacao manual entre varios sistemas de pagamento.",
  ];

  const features = [
    "Gestao de planos e assinaturas (em breve).",
    "Controles de limites por produto e tier do Workspace.",
    "Relatorios de cobranca e consumo para administradores.",
    "Integracoes com gateways (a definir) mantendo governanca.",
  ];

  const audiences = ["Administradores e financeiro", "Gestores de rede ou instituicao", "Times que precisam de visao de consumo"];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">KnexPay</h1>
          <p className="text-lg text-slate-700">
            Billing e gestao de planos do KnexIT Workspace. Modulo em evolucao, pensado para centralizar cobranca e limites.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">O que o KnexPay resolve</h2>
          <p className="text-base text-slate-700">Planeja unificar cobranca e limites dos produtos da suite em um painel unico.</p>
          <ul className="list-disc space-y-2 pl-5 text-slate-700">
            {problems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">Principais recursos</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-700">
            {features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-sm text-slate-600">Status: em breve, acompanhando roadmap do Workspace.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">Para quem e</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-700">
            {audiences.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <div>
          <Link
            href="/knexit-workspace"
            className="inline-flex rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500"
          >
            Voltar ao KnexIT Workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
