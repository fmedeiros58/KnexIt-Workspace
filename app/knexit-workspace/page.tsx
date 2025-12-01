import type { JSX } from "react";
import BenefitsSection from "./components/BenefitsSection";
import FaqSection from "./components/FaqSection";
import FinalCtaSection from "./components/FinalCtaSection";
import HeroSection from "./components/HeroSection";
import HowItWorksSection from "./components/HowItWorksSection";
import PlansSection from "./components/PlansSection";
import ProductsStrip from "./components/ProductsStrip";
import SecuritySection from "./components/SecuritySection";
import UseCasesSection from "./components/UseCasesSection";
import FooterSection from "./components/FooterSection";

export default function KnexItWorkspacePage() {
  const headerProducts = [
    { slug: "vioclass", label: "VC", icon: "play" as const, bg: "bg-indigo-50", fg: "text-indigo-700" },
    { slug: "violive", label: "VL", icon: "live" as const, bg: "bg-rose-50", fg: "text-rose-700" },
    { slug: "supadrive", label: "SD", icon: "supadrive" as const, bg: "bg-blue-50", fg: "text-blue-700" },
    { slug: "vioread", label: "VR", icon: "read" as const, bg: "bg-indigo-50", fg: "text-indigo-700" },
    { slug: "knexai", label: "AI", icon: "brain" as const, bg: "bg-fuchsia-50", fg: "text-fuchsia-700" },
  ];

  const headerIcons: Record<
    (typeof headerProducts)[number]["icon"],
    { node: JSX.Element }
  > = {
    play: {
      node: (
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
      node: (
        <>
          <rect x="2.4" y="2.4" width="19.2" height="19.2" rx="5.6" fill="white" />
          <rect x="4.6" y="10.1" width="11.8" height="8.2" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="7.2" cy="6.1" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="13.1" cy="5.5" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M19.8 12.2 16.4 13.0v1.6l3.4 0.8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ),
    },
    supadrive: {
      node: (
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
    read: {
      node: (
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
    brain: {
      node: <path fill="currentColor" d="M9.5 4A2.5 2.5 0 0 0 7 6.5v11A2.5 2.5 0 0 0 9.5 20H11V4H9.5Zm5 0H13v16h1.5A2.5 2.5 0 0 0 17 17.5v-11A2.5 2.5 0 0 0 14.5 4Z" />,
    },
  };

  const HeaderIcon = ({ icon, bg, fg }: { icon: keyof typeof headerIcons; bg: string; fg: string }) => {
    const cfg = headerIcons[icon];
    return (
      <div className={`inline-flex h-14 w-14 items-center justify-center rounded-xl ${bg}`}>
        <svg viewBox="0 0 24 24" className={`h-12 w-12 ${fg}`} aria-hidden>
          {cfg.node}
        </svg>
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
      <FooterSection />
    </main>
  );
}
