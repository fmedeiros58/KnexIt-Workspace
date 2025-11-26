import BrandingPage from "../../../components/BrandingPage";

export default function KnexPayBranding() {
  return (
    <BrandingPage
      slug="knexpay"
      heroTitle="KnexPay: cobrança e pagamentos"
      heroDescription="Estruture planos, faturamento e conciliação para a suíte KnexIT."
      featureCards={[
        { title: "Planos e assinaturas", body: "Modelos de billing configuráveis." },
        { title: "Gateways integráveis", body: "Ex.: Mercado Pago; flexível para outros." },
        { title: "Webhooks e relatórios", body: "Base para conciliação e auditoria." },
        { title: "Integração com produtos", body: "Habilite/limite recursos conforme plano." },
      ]}
      benefits={[
        "Gestão unificada de cobrança.",
        "Visibilidade de status e falhas.",
        "Pronto para ampliar integrações de pagamento.",
      ]}
    />
  );
}
