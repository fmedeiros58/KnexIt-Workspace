import HeroSection from "./components/HeroSection";
import ProblemsSection from "./components/ProblemsSection";
import AudienceSection from "./components/AudienceSection";
import FeaturesSection from "./components/FeaturesSection";
import CtaSection from "./components/CtaSection";

export default function KnexFlowLobby() {
  return (
    <main className="bg-white text-slate-900">
      <HeroSection />
      <ProblemsSection />
      <AudienceSection />
      <FeaturesSection />
      <CtaSection />
    </main>
  );
}
