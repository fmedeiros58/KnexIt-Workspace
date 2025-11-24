import BenefitsSection from "./components/BenefitsSection";
import FaqSection from "./components/FaqSection";
import FinalCtaSection from "./components/FinalCtaSection";
import HeroSection from "./components/HeroSection";
import HowItWorksSection from "./components/HowItWorksSection";
import PlansSection from "./components/PlansSection";
import ProductsStrip from "./components/ProductsStrip";
import SecuritySection from "./components/SecuritySection";
import UseCasesSection from "./components/UseCasesSection";

export default function KnexItWorkspacePage() {
  const headerProducts = [
    { slug: "vioclass", label: "VC", icon: "play" as const, bg: "bg-indigo-50", fg: "text-indigo-700" },
    { slug: "violive", label: "VL", icon: "live" as const, bg: "bg-rose-50", fg: "text-rose-700" },
    { slug: "supadrive", label: "SD", icon: "folder" as const, bg: "bg-amber-50", fg: "text-amber-700" },
    { slug: "vioread", label: "VR", icon: "doc" as const, bg: "bg-sky-50", fg: "text-sky-700" },
    { slug: "knexai", label: "AI", icon: "brain" as const, bg: "bg-fuchsia-50", fg: "text-fuchsia-700" },
  ];

  const HeaderIcon = ({ icon, bg, fg }: { icon: string; bg: string; fg: string }) => {
    return (
      <div className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${bg}`}>
        {icon === "live" ? (
          <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden>
            <rect x="3" y="7" width="11" height="10" rx="2" fill="#1A73E8" />
            <rect x="5" y="6" width="11" height="10" rx="2" fill="#FBBC04" />
            <rect x="6" y="8" width="11" height="10" rx="2" fill="#34A853" />
            <path d="M15.5 9.75 21 12.2l-5.5 2.45v-4.9Z" fill="#0F9D58" />
            <circle cx="11" cy="13" r="2" fill="white" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className={`h-5 w-5 ${fg}`} aria-hidden>
            {icon === "play" && <path fill="currentColor" d="M9 7.5v9l7-4.5-7-4.5Z" />}
            {icon === "folder" && <path fill="currentColor" d="M4 6h5l2 2h9v10H4V6Z" />}
            {icon === "doc" && (
              <path
                fill="currentColor"
                d="M7 4h7l4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm6 1.5V9h3.5L13 5.5Zm-5 6h8v1.5H8Zm0 3h5v1.5H8Z"
              />
            )}
            {icon === "brain" && (
              <path fill="currentColor" d="M9.5 4A2.5 2.5 0 0 0 7 6.5v11A2.5 2.5 0 0 0 9.5 20H11V4H9.5Zm5 0H13v16h1.5A2.5 2.5 0 0 0 17 17.5v-11A2.5 2.5 0 0 0 14.5 4Z" />
            )}
          </svg>
        )}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-4">
            <div className="text-xl md:text-2xl font-bold">
              <span className="bg-gradient-to-r from-red-600 via-red-500 to-black bg-clip-text text-transparent">KnexIT</span>{" "}
              <span className="text-black">Workspace</span>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-slate-500">
              {headerProducts.map((p) => (
                <span key={p.slug} className="inline-flex h-12 w-12 items-center justify-center">
                  <HeaderIcon icon={p.icon} bg="bg-transparent" fg={p.fg} />
                </span>
              ))}
            </div>
          </div>
          <nav className="flex flex-1 items-center justify-end gap-3 text-sm font-semibold text-slate-700">
            <a href="#produtos" className="hover:text-indigo-600">
              Produtos
            </a>
            <a href="#planos" className="hover:text-indigo-600">
              Planos
            </a>
            <a href="#contato" className="hover:text-indigo-600">
              Contato
            </a>
            <a
              href="#contato"
              className="hidden sm:inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Fale com a equipe de vendas
            </a>
            <a
              href="/knexit-workspace#planos"
              className="inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Iniciar agora
            </a>
          </nav>
        </div>
      </header>

      <HeroSection />
      <PlansSection />
      <ProductsStrip />
      <HowItWorksSection />
      <BenefitsSection />
      <SecuritySection />
      <UseCasesSection />
      <FaqSection />
      <FinalCtaSection />
    </main>
  );
}
