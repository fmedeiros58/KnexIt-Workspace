import BrandingPage from "../../viorecord/components/BrandingPage";

export default function VioRecordBranding() {
  return (
    <BrandingPage
      slug="viorecord"
      heroTitle="VioRecord: gravação de tela, webcam e voz no navegador"
      heroDescription="Capture aulas, tutoriais e demonstrações e publique rápido no VioClass ou SupaDrive."
      featureCards={[
        { title: "Gravação direta no browser", body: "Tela, webcam e microfone sem instalar software pesado." },
        { title: "Exportação simples", body: "Envie para VioClass, SupaDrive ou compartilhe por link." },
        { title: "Edição básica", body: "Cortes rápidos e revisão leve para publicar em minutos." },
        { title: "Perfis de captura", body: "Salve configurações para repetir o mesmo setup." },
      ]}
      benefits={[
        "Produção rápida de videoaulas e tutoriais.",
        "Fluxo direto para o ecossistema (aulas e arquivos).",
        "Padrão consistente de qualidade audiovisual.",
      ]}
    />
  );
}

