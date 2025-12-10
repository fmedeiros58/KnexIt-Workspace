import ResourceLayout from "../_components/ResourceLayout";

export default function FaqPage() {
  return (
    <ResourceLayout
      title="FAQ"
      subtitle="Dúvidas frequentes e atalhos úteis."
      intro="Respostas rápidas para as perguntas mais comuns sobre uso, acesso e operações."
      highlights={[
        { title: "Acesso e permissões", desc: "Como convidar pessoas, ajustar perfis e resolver acessos." },
        { title: "Armazenamento e compartilhamento", desc: "Boas práticas para organizar e compartilhar materiais." },
        { title: "Suporte e ajuda", desc: "Onde abrir tickets, consultar status e acessar a central de ajuda." },
      ]}
    />
  );
}
