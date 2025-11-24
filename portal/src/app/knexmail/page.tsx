import Link from "next/link";

const EMAIL_APPS = ["VioLive", "VioClass", "SupaDrive", "KnexAI", "KnexDocs", "KnexFlow"];

const FEATURE_CARDS = [
  {
    title: "Templates inteligentes",
    body: "Padronize avisos de aula, lembretes de live e comunicados institucionais com variaveis e personalizacao.",
  },
  {
    title: "Envios transacionais e campanhas",
    body: "Dispare confirmacoes, convites e avisos em massa para turmas, listas ou segmentos especificos.",
  },
  {
    title: "Providers plugaveis",
    body: "SMTP, SendGrid ou SES. Escolha o provedor e troque depois sem reescrever a logica de envio.",
  },
  {
    title: "Logs e rastreabilidade",
    body: "Veja status de entrega, falhas e historico para comprovar disparos importantes.",
  },
];

const BENEFITS = [
  "Lembretes de VioLive e novas aulas do VioClass enviados automaticamente.",
  "Modelos reutilizaveis para avisos academicos, provas e comunicados de secretaria.",
  "Placeholders para personalizar nome, curso, datas e links sem perder consistencia.",
  "Facil de integrar com fluxos do KnexFlow e arquivos do SupaDrive.",
];

export default function KnexMailPage() {
  return (
    <main className="bg-white text-slate-900">
      <section className="bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-16 pt-12 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="space-y-4 md:w-1/2">
            <div className="flex flex-wrap items-center gap-2 text-slate-600">
              {EMAIL_APPS.map((app) => (
                <span key={app} className="rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-sm border border-slate-200">
                  {app}
                </span>
              ))}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight text-slate-900">
              KnexMail: e-mails e campanhas que falam com toda a suite
            </h1>
            <p className="text-lg text-slate-700">
              Envie lembretes, comunicados e convites em massa com templates inteligentes, integracao a lives, aulas e fluxos de trabalho.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="#cta" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold shadow-sm">
                Fale com o time
              </Link>
              <Link href="/knexit-workspace#planos" className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 px-6 py-3 rounded-xl font-semibold">
                Ver planos
              </Link>
            </div>
          </div>

          <div className="md:w-1/2">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Template: Lembrete de VioLive</div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Automatizado</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-indigo-50/60 p-4 space-y-2">
                <p className="text-sm font-semibold text-slate-900">Assunto:</p>
                <p className="text-sm text-slate-700">Lembrete: sessao {"{{titulo_sessao}}"} hoje as {"{{horario}}"}</p>
                <p className="text-sm font-semibold text-slate-900 pt-2">Corpo:</p>
                <p className="text-sm text-slate-700">
                  Ola {"{{nome}}"},<br />
                  sua VioLive <strong>{"{{titulo_sessao}}"}</strong> comeca em breve. Acesse: {"{{link}}"}.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Status e logs</p>
                <p className="text-sm text-slate-600">Entregues: 98% · Falhas: 2% · Provider: SMTP</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="space-y-3 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Pensado para comunicacao integrada</h2>
          <p className="text-lg text-slate-600">
            De lembretes de VioLive a convites de aula, tudo sai do mesmo lugar, com templates e variaveis.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {FEATURE_CARDS.map((card) => (
            <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition">
              <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-12">
        <div className="mx-auto max-w-6xl px-4 md:px-6 grid gap-6 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-slate-900">Recursos principais do KnexMail</h2>
            <ul className="space-y-3 text-sm text-slate-700">
              {BENEFITS.map((b) => (
                <li key={b} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Campanha: Boas-vindas VioClass</div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Rascunho</span>
            </div>
            <p className="text-sm text-slate-700">
              Envie boas-vindas automaticas a novos alunos, com links de SupaDrive, calendario e convite para VioLive inaugural.
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span>Template: boas_vindas</span>
                <span className="text-xs text-slate-500">placeholders: nome, curso, link_login</span>
              </div>
              <div>Destino: lista Alunos 2025 · Envio imediato</div>
            </div>
          </div>
        </div>
      </section>

      <section id="cta" className="py-14 bg-white">
        <div className="mx-auto max-w-4xl text-center space-y-4">
          <h2 className="text-3xl font-bold text-slate-900">Pronto para conectar aulas, avisos e campanhas em um so lugar?</h2>
          <p className="text-lg text-slate-600">
            Fale com o time para alinhar necessidades ou comece a usar os templates de KnexMail agora mesmo.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="mailto:contato@exemplo.com" className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500">
              Falar com o time
            </Link>
            <Link href="/knexit-workspace#planos" className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-50">
              Ver planos
            </Link>
          </div>
          <div>
            <Link href="/knexit-workspace" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
              Voltar ao KnexIT Workspace
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
