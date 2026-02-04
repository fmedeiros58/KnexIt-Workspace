import type { JSX } from "react";
import BenefitsSection from "./components/BenefitsSection";
import FaqSection from "./components/FaqSection";
import FinalCtaSection from "./components/FinalCtaSection";
import HeroSection from "./components/HeroSection";
import HowItWorksSection from "./components/HowItWorksSection";
import PremiumValueSection from "./components/PremiumValueSection";
import PlansSection from "./components/PlansSection";
import ProductsStrip from "./components/ProductsStrip";
import SecuritySection from "./components/SecuritySection";
import UseCasesSection from "./components/UseCasesSection";
import FooterSection from "./components/FooterSection";

export default function KnexItWorkspacePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <HeroSection />
      <HowItWorksSection />
      <PremiumValueSection />
      <PlansSection />
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
