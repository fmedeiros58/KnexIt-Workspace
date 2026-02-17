// Landing Page: knexmail
import { notFound } from "next/navigation";
import { CATEGORY_LABEL, WORKSPACE_PRODUCTS } from "@/app/knexit-workspace/components/productsData";
import LandingHero from "./components/LandingHero";
import LandingIncluded from "./components/LandingIncluded";
import LandingDemo from "./components/LandingDemo";
import LandingSecurity from "./components/LandingSecurity";
import LandingUseCases from "./components/LandingUseCases";
import LandingCustomers from "./components/LandingCustomers";
import LandingResources from "./components/LandingResources";
import LandingFaq from "./components/LandingFaq";

const PRODUCT_SLUG = "knexmail";

const highlightsBySlug: Record<string, string[]> = {
  vioclass: ["Cursos sob demanda", "Biblioteca organizada", "Entrega contínua"],
  violive: ["Aulas ao vivo", "Mentorias síncronas", "Interação em tempo real"],
  viorecord: ["Captura de tela", "Webcam e áudio", "Edição rápida"],
  viostudio: ["Editor online", "Legendas inteligentes", "Fluxo simples"],
  vioanalytics: ["Métricas de engajamento", "Relatórios claros", "Insights acionáveis"],
  viohub: ["Produção integrada", "Entrega centralizada", "Operação escalável"],
  supadrive: ["Arquivos em nuvem", "Controle de acesso", "Compartilhamento rápido"],
  knexdocs: ["Documentos colaborativos", "Comentários em tempo real", "Histórico seguro"],
  knexflow: ["Quadros e tarefas", "Automação de fluxos", "Visão do time"],
  knexchat: ["Conversas organizadas", "Canais por equipe", "Mensagens rápidas"],
  knexsearch: ["Busca inteligente", "Resultados unificados", "Contexto por IA"],
  vioread: ["Leitura guiada", "Anotações fáceis", "Foco no estudo"],
  knexreview: ["Revisões estruturadas", "Rastreio de evidências", "Padronização"],
  knexai: ["Assistentes dedicados", "Automação com IA", "Produtividade ampliada"],
  knexmail: ["Envios seguros", "Campanhas e transações", "Entregabilidade"],
  knexpay: ["Planos e billing", "Cobrança recorrente", "Conciliação simples"],
};

export default function ProductLandingPage() {
  const product = WORKSPACE_PRODUCTS.find((item) => item.slug === PRODUCT_SLUG);
  if (!product) return notFound();

  const highlights = highlightsBySlug[product.slug] ?? [
    "Implementação rápida",
    "Integração com o ecossistema",
    "Operação confiável",
  ];

  return (
    <main className="min-h-screen bg-[#eef2f7] text-slate-900">
      <LandingHero
        badge={CATEGORY_LABEL[product.category]}
        title={product.name}
        subtitle={product.description}
        primaryCta={{ label: "Ver planos e preços", href: "/knexit-workspace/precos" }}
        secondaryCta={{ label: "Solicitar demonstração", href: "/knexit-workspace/acesso" }}
      />
      <LandingIncluded
        title="A IA premium está incluída nos planos"
        description="A assistência de IA está disponível onde você mais precisa, ajudando equipes a trabalhar com mais rapidez e inteligência."
        highlights={highlights}
      />
      <LandingDemo
        title="Veja na prática"
        description="Mostre fluxos reais de uso, integrações e exemplos prontos para a equipe adotar imediatamente."
      />
      <LandingSecurity />
      <LandingUseCases
        title="Exemplos de uso"
        description="Casos práticos para diferentes áreas, com processos claros e resultados mensuráveis."
      />
      <LandingCustomers />
      <LandingResources />
      <LandingFaq />
    </main>
  );
}
