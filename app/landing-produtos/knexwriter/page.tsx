import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, FileText, Layers3, PenLine } from "lucide-react";

const features = [
  {
    title: "Editor com IA",
    description: "Escreva, revise e expanda textos com apoio inteligente.",
    icon: PenLine,
  },
  {
    title: "Projetos e seções",
    description: "Organize documentos em projetos, seções e blocos de escrita.",
    icon: Layers3,
  },
  {
    title: "Paginação A4",
    description: "Visualize o texto em formato de página durante a escrita.",
    icon: FileText,
  },
  {
    title: "Assistente contextual",
    description: "Gere introduções, conclusões, argumentos e melhorias textuais.",
    icon: Bot,
  },
];

const benefits = [
  "Escrita assistida por IA.",
  "Organização por projetos e seções.",
  "Paginação automática em A4.",
  "Integração com o ecossistema KnexAI e Letícia.",
];

export default function KnexWriterLandingPage() {
  return (
    <main className="min-h-screen bg-[#f7f7f8] text-zinc-950">
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-4xl">
            <div className="mb-6 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              Escrita assistida por IA
            </div>

            <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
              KnexWriter: escreva textos longos com inteligência, estrutura e continuidade.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
              Um ambiente independente para produção textual com IA, pensado para criar,
              expandir, revisar e organizar documentos em projetos e seções.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/knexwriter/web"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Abrir KnexWriter
                <ArrowRight size={17} />
              </Link>

              <a
                href="#recursos"
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Ver recursos
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <h2 className="text-4xl font-semibold tracking-tight">
          Um produto próprio para escrita.
        </h2>

        <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-600">
          O KnexWriter transforma o modo escrita em uma experiência independente,
          com fluxo próprio para produção textual.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.title}
                className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                  <Icon size={22} />
                </div>

                <h3 className="text-lg font-semibold">{feature.title}</h3>

                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-4xl font-semibold tracking-tight">
            Benefícios do KnexWriter
          </h2>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {benefits.map((benefit) => (
              <div
                key={benefit}
                className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-[#f7f7f8] p-4"
              >
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} />
                <p className="text-sm leading-6 text-zinc-700">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}