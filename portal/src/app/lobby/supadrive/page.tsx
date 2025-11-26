import HeroSection from "./components/HeroSection";
import ProblemsSection from "./components/ProblemsSection";
import AudienceSection from "./components/AudienceSection";
import FeaturesSection from "./components/FeaturesSection";
import Link from "next/link";
import LobbyNav from "../../../components/LobbyNav";

export default function SupaDriveLobbyPage() {
  return (
    <main className="bg-white text-slate-900">
      <LobbyNav productSlug="supadrive" productName="SupaDrive" loginHref="http://localhost:3000/supadrive" />
      <HeroSection />
      <ProblemsSection />
      <AudienceSection />
      <FeaturesSection />
      <section id="cta" className="py-14 bg-white">
        <div className="mx-auto max-w-4xl text-center space-y-4">
          <h2 className="text-3xl font-bold text-slate-900">Pronto para usar o SupaDrive?</h2>
          <p className="text-lg text-slate-600">Acesse direto com sua conta KnexIT ou veja mais na página de branding.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/lobby/supadrive"
              className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500"
            >
              Acessar produto
            </Link>
            <Link
              href="/branding/supadrive"
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-50"
            >
              Ver branding
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
