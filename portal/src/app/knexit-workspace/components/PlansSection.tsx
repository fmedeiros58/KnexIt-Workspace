type PlanId = "starter" | "pro" | "plus" | "enterprise";

interface Plan {
  id: PlanId;
  name: string;
  highlight?: boolean;
  description: string;
  priceLabel: string;
  billingNote?: string;
  idealFor: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Para professores individuais e pequenos times.",
    priceLabel: "R$ XX / usuário / mês",
    billingNote: "Cobrança mensal ou anual",
    idealFor: "Professores individuais, pequenos times.",
    features: [
      "Acesso ao VioClass e VioLive com limites básicos",
      "SupaDrive com armazenamento inicial para materiais",
      "KnexDocs e KnexFlow para organizar conteúdos e tarefas",
      "Uso inicial de KnexAI e KnexSearch",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    highlight: true,
    description: "Mais popular para escolas e departamentos.",
    priceLabel: "R$ YY / usuário / mês",
    billingNote: "Cobrança mensal ou anual",
    idealFor: "Escolas, cursinhos e departamentos.",
    features: [
      "Tudo do Starter",
      "Mais armazenamento no SupaDrive",
      "Mais recursos de VioLive e VioAnalytics",
      "Uso ampliado de VioRead, KnexReview e KnexAI",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    description: "Para redes e instituições com múltiplos campi.",
    priceLabel: "R$ ZZ / usuário / mês",
    billingNote: "Cobrança mensal ou anual",
    idealFor: "Instituições com múltiplos campi, redes de ensino.",
    features: [
      "Tudo do Pro",
      "Métricas avançadas e relatórios consolidados",
      "Automação de envios via KnexMail",
      "Fluxos complexos com KnexFlow",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Para grandes redes e universidades.",
    priceLabel: "Fale com o time",
    idealFor: "Grandes redes, secretarias, universidades, poder público.",
    features: [
      "Tudo do Plus",
      "Atendimento dedicado e suporte prioritário",
      "Opções avançadas de segurança e integrações",
      "Estudo de casos personalizados para sua realidade",
    ],
  },
];

export default function PlansSection() {
  const ICONS = {
    play: { bg: "bg-indigo-100", fg: "text-indigo-700", path: <path fill="currentColor" d="M9 7.5v9l7-4.5-7-4.5Z" /> },
    live: {
      bg: "bg-rose-100",
      fg: "text-rose-700",
      path: (
        <g>
          <rect x="3" y="7" width="11" height="10" rx="2" fill="#1A73E8" />
          <rect x="5" y="6" width="11" height="10" rx="2" fill="#FBBC04" />
          <rect x="6" y="8" width="11" height="10" rx="2" fill="#34A853" />
          <path d="M15.5 9.75 21 12.2l-5.5 2.45v-4.9Z" fill="#0F9D58" />
          <circle cx="11" cy="13" r="2" fill="white" />
        </g>
      ),
    },
    folder: { bg: "bg-amber-100", fg: "text-amber-700", path: <path fill="currentColor" d="M4 6h5l2 2h9v10H4V6Z" /> },
    doc: {
      bg: "bg-sky-100",
      fg: "text-sky-700",
      path: (
        <path
          fill="currentColor"
          d="M7 4h7l4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm6 1.5V9h3.5L13 5.5Zm-5 6h8v1.5H8Zm0 3h5v1.5H8Z"
        />
      ),
    },
    kanban: { bg: "bg-emerald-100", fg: "text-emerald-700", path: <path fill="currentColor" d="M5 5h14v14H5V5Zm2 2.5v9h2v-9H7Zm4 0v4h2v-4h-2Zm4 0v6.5h2v-6.5h-2Z" /> },
    chat: {
      bg: "bg-teal-100",
      fg: "text-teal-700",
      path: <path fill="currentColor" d="M5 5h14v9H9l-4 4V5Zm2.5 3.5v1.5h9V8.5h-9Zm0 3v1.5h6V11.5h-6Z" />,
    },
    search: {
      bg: "bg-purple-100",
      fg: "text-purple-700",
      path: <path fill="currentColor" d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm5.5 11.1 3.4 3.4-1.4 1.4-3.4-3.4 1.4-1.4Z" />,
    },
    brain: {
      bg: "bg-fuchsia-100",
      fg: "text-fuchsia-700",
      path: <path fill="currentColor" d="M9.5 4A2.5 2.5 0 0 0 7 6.5v11A2.5 2.5 0 0 0 9.5 20H11V4H9.5Zm5 0H13v16h1.5A2.5 2.5 0 0 0 17 17.5v-11A2.5 2.5 0 0 0 14.5 4Z" />,
    },
    mail: {
      bg: "bg-blue-100",
      fg: "text-blue-700",
      path: <path fill="currentColor" d="M5 6h14a1 1 0 0 1 1 1v10H4V7a1 1 0 0 1 1-1Zm13 2.24-6 3.51-6-3.5V8l6 3.5 6-3.5v.24Z" />,
    },
    credit: {
      bg: "bg-slate-100",
      fg: "text-slate-700",
      path: <path fill="currentColor" d="M4 6h16a1 1 0 0 1 1 1v10H3V7a1 1 0 0 1 1-1Zm1.5 4.5v1.5h5v-1.5h-5Zm0 3v1.5h3v-1.5h-3Z" />,
    },
  };

  const APPS = [
    { name: "VioClass", slug: "vioclass", icon: "play" as const },
    { name: "VioLive", slug: "violive", icon: "live" as const },
    { name: "VioRecord", slug: "viorecord", icon: "play" as const },
    { name: "VioStudio", slug: "viostudio", icon: "play" as const },
    { name: "VioAnalytics", slug: "vioanalytics", icon: "doc" as const },
    { name: "SupaDrive", slug: "supadrive", icon: "folder" as const },
    { name: "VioRead", slug: "vioread", icon: "doc" as const },
    { name: "KnexReview", slug: "knexreview", icon: "doc" as const },
    { name: "KnexDocs", slug: "knexdocs", icon: "doc" as const },
    { name: "KnexFlow", slug: "knexflow", icon: "kanban" as const },
    { name: "KnexChat", slug: "knexchat", icon: "chat" as const },
    { name: "KnexSearch", slug: "knexsearch", icon: "search" as const },
    { name: "KnexAI", slug: "knexai", icon: "brain" as const },
    { name: "KnexMail", slug: "knexmail", icon: "mail" as const },
    { name: "KnexPay", slug: "knexpay", icon: "credit" as const },
  ];

  const IconBadge = ({ icon, label }: { icon: keyof typeof ICONS; label: string }) => {
    const cfg = ICONS[icon];
    return (
      <div className="flex flex-col items-center gap-2">
        <div className={`inline-flex h-20 w-20 items-center justify-center rounded-2xl ${cfg.bg}`}>
          <svg viewBox="0 0 24 24" className={`h-11 w-11 ${cfg.fg}`} aria-hidden>
            {cfg.path}
          </svg>
        </div>
        <span className="text-xs font-semibold text-slate-700">{label}</span>
      </div>
    );
  };

  return (
    <section id="planos" className="bg-slate-50 py-14">
      <div className="mx-auto max-w-6xl px-4 md:px-6 space-y-10">
        <div className="space-y-3 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Encontre o plano ideal para sua instituição</h2>
          <p className="text-lg text-slate-600">
            Planos pensados para diferentes portes, de professores individuais a grandes redes. Escolha o nível de
            recursos, IA e colaboração que faz sentido para sua realidade.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          {APPS.map((app) => (
            <a key={app.slug} href={`/${app.slug}`} className="flex flex-col items-center gap-2 hover:scale-105 transition">
              <IconBadge icon={app.icon} label={app.name} />
            </a>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition bg-white ${
                plan.highlight ? "ring-2 ring-indigo-500" : ""
              }`}
            >
              {plan.highlight ? (
                <span className="inline-flex items-center rounded-full bg-emerald-500 text-white text-xs font-semibold px-2 py-1 mb-3">
                  Mais popular
                </span>
              ) : null}
              <h3 className="text-xl font-semibold text-slate-900">{plan.name}</h3>
              <p className="text-slate-700 text-sm mt-1">{plan.description}</p>
              <div className="mt-3 text-2xl font-bold text-slate-900">{plan.priceLabel}</div>
              {plan.billingNote ? <div className="text-xs text-slate-500">{plan.billingNote}</div> : null}
              <div className="mt-2 text-sm text-slate-600">{plan.idealFor}</div>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-emerald-600">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                <button className="w-full rounded-xl bg-indigo-600 text-white font-semibold px-4 py-2 hover:bg-indigo-500">
                  {plan.id === "enterprise" ? "Falar com o time" : "Começar agora"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
