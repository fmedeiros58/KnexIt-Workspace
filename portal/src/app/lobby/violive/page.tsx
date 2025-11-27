import HeroSection from "./components/HeroSection";
import ProblemsSection from "./components/ProblemsSection";
import AudienceSection from "./components/AudienceSection";
import FeaturesSection from "./components/FeaturesSection";
import CtaSection from "./components/CtaSection";
import LobbyNav from "../_shared/LobbyNav";

export default function VioLiveLobby() {
  return (
    <main className="bg-white text-slate-900">
      <LobbyNav productSlug="violive" productName="VioLive" />
      <HeroSection />
      <ProblemsSection />
      <AudienceSection />
      <FeaturesSection />
      <CtaSection />
    </main>
  );
}
