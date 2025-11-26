import LobbyPage from "../../../components/LobbyPage";

export default function KnexPayLobby() {
  return (
    <LobbyPage
      slug="knexpay"
      title="KnexPay"
      headline="Cobrança e pagamentos para a suíte KnexIT."
      intro="Estruture planos, faturamento e conciliação para os produtos do ecossistema."
      problems={[
        "Gerenciar planos e cobranças de forma unificada.",
        "Integrar pagamentos aos fluxos de produto.",
        "Ter visibilidade de status, falhas e conciliações.",
      ]}
      features={[
        "Base para planos e assinaturas.",
        "Integração com gateways (ex.: Mercado Pago) a definir.",
        "Webhooks e relatórios para conciliação (futuro).",
      ]}
      audiences={["Financeiro/ops", "Times de produto", "Gestão acadêmica"]}
    />
  );
}
