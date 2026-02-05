import type { JSX } from "react";
import BenefitsSection from "./components/BenefitsSection";
import FaqSection from "./components/FaqSection";
import FinalCtaSection from "./components/FinalCtaSection";
import HeroSection from "./components/HeroSection";
import HowItWorksSection from "./components/HowItWorksSection";
import PremiumValueSection from "./components/PremiumValueSection";
import PricingSection from "./components/PricingSection";
import PlansSection from "./components/PlansSection";
import ProductsStrip from "./components/ProductsStrip";
import SecuritySection from "./components/SecuritySection";
import StickyNav from "./components/StickyNav";
import UseCasesSection from "./components/UseCasesSection";
import FooterSection from "./components/FooterSection";

export default function KnexItWorkspacePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <HeroSection />
      <StickyNav
        items={[
          { label: "O que est\u00e1 inclu\u00eddo", href: "#produtos" },
          { label: "Recursos premium", href: "#premium" },
          { label: "Planos e pre\u00e7os", href: "#precos" },
          { label: "Perguntas frequentes", href: "#faq" },
        ]}
      />
      <PlansSection />
      <HowItWorksSection />
      <PremiumValueSection />
      <PricingSection />
      <ProductsStrip />
      <BenefitsSection />
      <SecuritySection />
      <UseCasesSection />
      <FaqSection />
      <FinalCtaSection />
      <FooterSection />
    </main>
  );
}
