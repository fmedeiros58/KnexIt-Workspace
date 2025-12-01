import HeroSection from "./components/HeroSection";
import ProblemsSection from "./components/ProblemsSection";
import AudienceSection from "./components/AudienceSection";
import FeaturesSection from "./components/FeaturesSection";
import CtaSection from "./components/CtaSection";
import LobbyNav from "../_shared/LobbyNav";

export default function VioClassLobby() {
  return (
    <main className="bg-white text-slate-900">
      <LobbyNav productSlug="vioclass" productName="VioClass" />
      <HeroSection />
      <ProblemsSection />
      <AudienceSection />
      <FeaturesSection />
      <CtaSection />
    </main>
  );
}
