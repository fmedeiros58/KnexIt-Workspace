// Landing Page: landing-ia
import LandingIaHero from "./components/LandingIaHero";

export default function LandingIaPage() {
  return (
    <main className="min-h-screen bg-[#eef2f7] text-slate-900">
      <LandingIaHero
        title="Ferramentas de IA para ajudar no trabalho"
        description="Tenha novas ideias, economize tempo e aumente a produtividade com o app do Gemini, o NotebookLM, o Vids e muito mais."
        primaryCta={{
          label: "Iniciar agora",
          href: "/login",
        }}
        secondaryCta={{
          label: "Fale com a equipe de vendas",
          href: "https://workspace.google.com/intl/pt-BR/contact/?source=gafb-ai-hero-pt-BR",
        }}
        videoTitle="Demonstração: IA para produtividade"
        videoSrc="https://www.youtube.com/embed/VOcSrLykC4E"
      />
    </main>
  );
}
