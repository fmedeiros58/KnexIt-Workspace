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

export const PLANS: Plan[] = [
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

const ICONS = {
    play: {
      bg: "bg-indigo-100",
      fg: "text-indigo-700",
      path: (
        <>
          <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5.2" fill="white" />
          <rect x="5.2" y="5.8" width="13.6" height="8.6" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="9.9" r="1.7" fill="currentColor" />
          <rect x="10.4" y="11.7" width="3.2" height="2.8" rx="0.8" fill="currentColor" />
          <rect x="5.2" y="16.1" width="13.6" height="1.7" rx="0.7" fill="currentColor" />
          <rect x="6.1" y="17.9" width="1.6" height="1.3" rx="0.3" fill="currentColor" />
          <rect x="9.3" y="17.9" width="1.6" height="1.3" rx="0.3" fill="currentColor" />
          <rect x="12.5" y="17.9" width="1.6" height="1.3" rx="0.3" fill="currentColor" />
          <rect x="15.7" y="17.9" width="1.6" height="1.3" rx="0.3" fill="currentColor" />
        </>
      ),
    },
    live: {
      bg: "bg-rose-100",
      fg: "text-rose-700",
      path: (
        <>
          <rect x="2.4" y="2.4" width="19.2" height="19.2" rx="5.6" fill="white" />
          <rect x="4.6" y="10.1" width="11.8" height="8.2" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="7.2" cy="6.1" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="13.1" cy="5.5" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M19.8 12.2 16.4 13.0v1.6l3.4 0.8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ),
    },
    folder: { bg: "bg-amber-100", fg: "text-amber-700", path: <path fill="currentColor" d="M4 6h5l2 2h9v10H4V6Z" /> },
    supadrive: {
      bg: "bg-blue-100",
      fg: "text-blue-700",
      path: (
        <>
          <path fill="currentColor" d="M4 6h5l2 2h9v10H4V6Z" />
          <path
            d="M8.5 13.5c0-.9.7-1.6 1.6-1.6.6 0 1.1.3 1.8 1l.2.2.2-.2c.7-.7 1.2-1 1.8-1 1 0 1.7.7 1.7 1.6s-.7 1.6-1.7 1.6c-.6 0-1.1-.3-1.8-1l-.2-.2-.2.2c-.7.7-1.2 1-1.8 1-.9 0-1.6-.7-1.6-1.6Z"
            fill="none"
            stroke="white"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ),
    },
    doc: {
      bg: "bg-sky-100",
      fg: "text-sky-700",
      path: (
        <>
          <path
            fill="currentColor"
            d="M6.5 4h7l3.5 3.5V18a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 0v3.5H17L13.5 4Z"
          />
          <rect x="8" y="9" width="6.5" height="1.2" rx="0.6" fill="white" fillOpacity="0.85" />
          <rect x="8" y="11" width="5.2" height="1.2" rx="0.6" fill="white" fillOpacity="0.75" />
          <rect x="8" y="13" width="4.2" height="1.2" rx="0.6" fill="white" fillOpacity="0.65" />
          <circle cx="15.5" cy="15.5" r="1.4" fill="white" fillOpacity="0.9" />
          <circle cx="17.6" cy="14.9" r="1.4" fill="white" fillOpacity="0.75" />
        </>
      ),
    },
    kanban: { bg: "bg-emerald-100", fg: "text-emerald-700", path: <path fill="currentColor" d="M5 5h14v14H5V5Zm2 2.5v9h2v-9H7Zm4 0v4h2v-4h-2Zm4 0v6.5h2v-6.5h-2Z" /> },
  chat: {
    bg: "bg-teal-100",
    fg: "text-teal-700",
    path: <path fill="currentColor" d="M5 5h14v9H9l-4 4V5Zm2.5 3.5v1.5h9V8.5h-9Zm0 3v1.5h6V11.5h-6Z" />,
  },
  review: {
    bg: "bg-emerald-100",
    fg: "text-emerald-700",
    path: (
      <>
        <path fill="currentColor" d="M7 4h7l4 4v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 0v4h4l-4-4Z" />
        <rect x="8.2" y="10" width="6" height="1.1" rx="0.55" fill="white" fillOpacity="0.85" />
        <rect x="8.2" y="12" width="4.5" height="1.1" rx="0.55" fill="white" fillOpacity="0.7" />
        <circle cx="16.8" cy="16.2" r="1.8" fill="white" fillOpacity="0.95" />
        <path d="m16.1 16.2 0.8 0.8 1.6-1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  analytics: {
    bg: "bg-cyan-100",
    fg: "text-cyan-700",
    path: (
      <>
        <path fill="currentColor" d="M6.5 5h11a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5v-11A1.5 1.5 0 0 1 6.5 5Z" />
        <rect x="7.5" y="12.8" width="1.8" height="4.2" rx="0.6" fill="white" />
        <rect x="10.1" y="11.2" width="1.8" height="5.8" rx="0.6" fill="white" fillOpacity="0.85" />
        <rect x="12.7" y="9.7" width="1.8" height="7.3" rx="0.6" fill="white" fillOpacity="0.7" />
        <rect x="15.3" y="8.5" width="1.8" height="8.5" rx="0.6" fill="white" fillOpacity="0.55" />
      </>
    ),
  },
  read: {
    bg: "bg-indigo-100",
    fg: "text-indigo-700",
    path: (
      <>
        <path fill="currentColor" d="M7 4h7l4 4v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 0v4h4l-4-4Z" />
        <rect x="7.2" y="9.3" width="6.3" height="1.1" rx="0.55" fill="white" fillOpacity="0.85" />
        <rect x="7.2" y="11.3" width="4.9" height="1.1" rx="0.55" fill="white" fillOpacity="0.7" />
        <path fill="white" fillOpacity="0.9" d="M7.2 14.3h3.3c.3 0 .58.26.58.58v2.5c0 .32-.28.58-.58.58H7.2c-.32 0-.58-.26-.58-.58v-2.5c0-.32.26-.58.58-.58Z" />
        <path fill="white" d="M11.4 15.1 13.3 16.1 11.4 17.2Z" />
        <path d="M13.6 14.8c.55.28.85.74.85 1.35s-.3 1.07-.85 1.35" stroke="white" strokeWidth="1" strokeLinecap="round" />
        <path d="M15.0 14.4c.75.36 1.1.93 1.1 1.77 0 .84-.35 1.41-1.1 1.77" stroke="white" strokeWidth="1" strokeLinecap="round" />
      </>
    ),
  },
  hub: {
    bg: "bg-orange-100",
    fg: "text-orange-700",
    path: (
      <>
        <circle cx="12" cy="6.5" r="2.1" fill="currentColor" />
        <circle cx="6.5" cy="14" r="2" fill="currentColor" />
        <circle cx="17.5" cy="14" r="2" fill="currentColor" />
        <path d="M8.2 12.6 10.7 8.9M15.9 12.6 13.3 8.9M10.2 13.9l3.6.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="12" cy="18.2" r="1.4" fill="currentColor" />
        <path d="m7.6 15.5 3 1.8m2.7 0 3.2-1.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </>
    ),
  },
  record: {
    bg: "bg-red-100",
    fg: "text-red-700",
    path: (
      <>
        <rect x="5.5" y="5.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="3.4" fill="currentColor" />
      </>
    ),
  },
  edit: {
    bg: "bg-red-100",
    fg: "text-red-700",
    path: (
      <g fill="currentColor">
        <path d="M5 5h9v2H5v10h10v-5h2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        <path d="M19.7 5.3 17.2 2.8a1 1 0 0 0-1.4 0L13 5.6V9h3.4l2.9-2.9a1 1 0 0 0 0-1.4Z" />
      </g>
    ),
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
  owl: {
    bg: "bg-fuchsia-100",
    fg: "text-fuchsia-700",
    path: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" fill="white" />
        <g fill="currentColor">
          <path d="M7.5 9.5c0-1.7 1.4-3 3-3s3 1.3 3 3c0 .6-.2 1.1-.5 1.5-.3.4-.8.7-1.3.7s-1-.3-1.3-.7c-.3-.4-.5-.9-.5-1.5z" />
          <path d="M6 13c0-1.9 3-2.8 6-2.8s6 .9 6 2.8c0 .9-1 2-3 2s-3-1-3-1-1.3 1-3 1-3-1.1-3-2z" />
          <circle cx="9.5" cy="9.3" r="1" fill="currentColor" />
          <circle cx="14.5" cy="9.3" r="1" fill="currentColor" />
          <path d="M12 11.2c.4.5.6 1 0 1.6-.6.6-1.4.6-2 0-.6-.6-.4-1.1 0-1.6.4-.5 1.2-.5 2 0z" fill="currentColor" />
        </g>
      </>
    ),
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
    { name: "VioRecord", slug: "viorecord", icon: "record" as const },
    { name: "VioStudio", slug: "viostudio", icon: "edit" as const },
    { name: "VioAnalytics", slug: "vioanalytics", icon: "analytics" as const },
    { name: "VioHub", slug: "viohub", icon: "hub" as const },
    { name: "SupaDrive", slug: "supadrive", icon: "supadrive" as const },
    { name: "VioRead", slug: "vioread", icon: "read" as const },
    { name: "KnexReview", slug: "knexreview", icon: "review" as const },
    { name: "KnexDocs", slug: "knexdocs", icon: "doc" as const },
    { name: "KnexFlow", slug: "knexflow", icon: "kanban" as const },
    { name: "KnexChat", slug: "knexchat", icon: "chat" as const },
    { name: "KnexSearch", slug: "knexsearch", icon: "search" as const },
    { name: "KnexAI", slug: "knexai", icon: "owl" as const },
    { name: "KnexMail", slug: "knexmail", icon: "mail" as const },
    { name: "KnexPay", slug: "knexpay", icon: "credit" as const },
  ];

const IconBadge = ({ icon, label }: { icon: keyof typeof ICONS; label: string }) => {
  const cfg = ICONS[icon];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white border border-slate-100 shadow-sm">
        <svg viewBox="0 0 24 24" className={`h-17 w-17 ${cfg.fg}`} aria-hidden style={{ transform: "translateX(0.5px)" }}>
          {cfg.path}
        </svg>
      </div>
      <span className="text-xs font-semibold text-slate-700">{label}</span>
    </div>
  );
};

export default function PlansSection() {

  return (
    <section id="planos" className="bg-[#E5F3F4] py-14">
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
            <a
                  key={app.slug}
                  href={`/lobby/${app.slug}`}
                  className="flex flex-col items-center gap-2 hover:scale-105 transition no-underline hover:no-underline focus:no-underline"
                >
              <IconBadge icon={app.icon} label={app.name} />
            </a>
          ))}
        </div>

      </div>
    </section>
  );
}
