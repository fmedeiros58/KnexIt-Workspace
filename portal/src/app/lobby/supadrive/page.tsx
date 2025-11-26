import HeroSection from "./components/HeroSection";
import ProblemsSection from "./components/ProblemsSection";
import AudienceSection from "./components/AudienceSection";
import FeaturesSection from "./components/FeaturesSection";
import CtaSection from "./components/CtaSection";
import LobbyNav from "../../supadrive/components/LobbyNav";

export default function SupaDriveLobbyPage() {
  return (
    <main className="bg-white text-slate-900">
      <LobbyNav productSlug="supadrive" productName="SupaDrive" loginHref="http://localhost:3000/supadrive" />
      <HeroSection />
      <ProblemsSection />
      <AudienceSection />
      <FeaturesSection />
      <CtaSection />
    </main>
  );
}
