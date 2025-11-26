import LobbyPage from "../../../components/LobbyPage";

export default function VioStudioLobby() {
  return (
    <LobbyPage
      slug="viostudio"
      title="VioStudio"
      headline="Edição e pós-produção online para aulas e lives."
      intro="Refine cortes, legendas e exports para publicar no VioClass ou SupaDrive."
      problems={[
        "Editar e montar aulas gravadas sem sair do navegador.",
        "Padronizar cortes e legendas para vídeos educacionais.",
        "Exportar versões prontas para aulas, lives e replays.",
      ]}
      features={[
        "Linha do tempo simples para cortes e ajustes rápidos.",
        "Legendas e marcação de capítulos.",
        "Exportações prontas para VioClass, SupaDrive ou compartilhamento.",
      ]}
      audiences={["Equipes de mídia", "Professores criadores", "Times de marketing/treinamento"]}
    />
  );
}
