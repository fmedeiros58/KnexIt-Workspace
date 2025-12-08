import BrandingPage from "../../viohub/components/BrandingPage";

export default function VioHubBranding() {
  return (
    <BrandingPage
      slug="viohub"
      heroTitle="VioHub: produção audiovisual integrada"
      heroDescription="Centralize roteiros, edição, revisão e entrega de vídeos com conexão direta ao SupaDrive e às demais apps."
      featureCards={[
        { title: "Pipeline completo", body: "Do roteiro à entrega final, com status e revisões no mesmo lugar." },
        { title: "Assets conectados", body: "Envie e recupere mídia do SupaDrive e publique para canais finais." },
        { title: "Times alinhados", body: "Feedbacks e aprovações centralizados para reduzir retrabalho." },
        { title: "Integrações planejadas", body: "Roteiros e replays vindos do VioClass/VioLive com entrega automatizada." },
      ]}
      benefits={[
        "Organização de projetos, clipes e entregas.",
        "Visibilidade de status para marketing, estúdio e pedagógico.",
        "Publicação com padrões de marca e qualidade.",
      ]}
      demo={{
        title: "Fluxo de produção e entrega",
        statusLabel: "Disponível",
        statusTone: "green",
        sections: [
          {
            title: "1) Roteiro e aprovação",
            lines: ["Organize versões e feedbacks para roteiros e pautas.", "Defina responsáveis e deadlines por projeto."],
          },
          {
            title: "2) Edição e revisão",
            lines: ["Track de cortes, clipes e assets conectados ao SupaDrive.", "Checklist de qualidade antes de publicar."],
          },
          {
            title: "3) Entrega e distribuição",
            lines: ["Entrega para SupaDrive e canais finais.", "Registro de histórico e status visível para stakeholders."],
          },
        ],
      }}
      ctaLabel="Acessar VioHub"
    />
  );
}
