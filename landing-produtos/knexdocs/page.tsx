// Landing Page: knexdocs
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

const PRODUCT_SLUG = "knexdocs";

const highlightsBySlug: Record<string, string[]> = {
  vioclass: ["Cursos sob demanda", "Biblioteca organizada", "Entrega cont?nua"],
  violive: ["Aulas ao vivo", "Mentorias s?ncronas", "Intera??o em tempo real"],
  viorecord: ["Captura de tela", "Webcam e ?udio", "Edi??o r?pida"],
  viostudio: ["Editor online", "Legendas inteligentes", "Fluxo simples"],
  vioanalytics: ["M?tricas de engajamento", "Relat?rios claros", "Insights acion?veis"],
  viohub: ["Produ??o integrada", "Entrega centralizada", "Opera??o escal?vel"],
  supadrive: ["Arquivos em nuvem", "Controle de acesso", "Compartilhamento r?pido"],
  knexdocs: ["Documentos colaborativos", "Coment?rios em tempo real", "Hist?rico seguro"],
  knexflow: ["Quadros e tarefas", "Automa??o de fluxos", "Vis?o do time"],
  knexchat: ["Conversas organizadas", "Canais por equipe", "Mensagens r?pidas"],
  knexsearch: ["Busca inteligente", "Resultados unificados", "Contexto por IA"],
  vioread: ["Leitura guiada", "Anota??es f?ceis", "Foco no estudo"],
  knexreview: ["Revis?es estruturadas", "Rastreio de evid?ncias", "Padroniza??o"],
  knexai: ["Assistentes dedicados", "Automa??o com IA", "Produtividade ampliada"],
  knexmail: ["Envios seguros", "Campanhas e transa??es", "Entregabilidade"],
  knexpay: ["Planos e billing", "Cobran?a recorrente", "Concilia??o simples"],
};

export default function ProductLandingPage() {
  const product = WORKSPACE_PRODUCTS.find((item) => item.slug === PRODUCT_SLUG);
  if (!product) return notFound();

  const highlights = highlightsBySlug[product.slug] ?? [
    "Implementa??o r?pida",
    "Integra??o com o ecossistema",
    "Opera??o confi?vel",
  ];

  return (
    <main className="min-h-screen bg-[#eef2f7] text-slate-900">
      <LandingHero
        badge={CATEGORY_LABEL[product.category]}
        title={product.name}
        subtitle={product.description}
        primaryCta={{ label: "Ver planos e pre?os", href: "/knexit-workspace/precos" }}
        secondaryCta={{ label: "Solicitar demonstra??o", href: "/knexit-workspace/acesso" }}
      />
      <LandingIncluded
        title="A IA premium est? inclu?da nos planos"
        description="A assist?ncia de IA est? dispon?vel onde voc? mais precisa, ajudando equipes a trabalhar com mais rapidez e intelig?ncia."
        highlights={highlights}
      />
      <LandingDemo
        title="Veja na pr?tica"
        description="Mostre fluxos reais de uso, integra??es e exemplos prontos para a equipe adotar imediatamente."
      />
      <LandingSecurity />
      <LandingUseCases
        title="Exemplos de uso"
        description="Casos pr?ticos para diferentes ?reas, com processos claros e resultados mensur?veis."
      />
      <LandingCustomers />
      <LandingResources />
      <LandingFaq />
    </main>
  );
}
