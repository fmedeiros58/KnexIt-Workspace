"use client";

import { useState } from "react";

export default function HowItWorksSection() {
  const [activeIndex, setActiveIndex] = useState<number | null>(0);
  const steps = [
    {
      title: "Centralize aulas, turmas e materiais",
      body: "Use VioClass para aulas e trilhas e armazene apostilas, slides e provas no SupaDrive com pastas por turma.",
    },
    {
      title: "Conecte aulas ao vivo, gravações e interações",
      body: "VioLive para encontros ao vivo, VioRecord para gravar, e KnexChat para manter conversas e avisos organizados.",
    },
    {
      title: "Ative IA para leitura, revisão e busca",
      body: "VioRead, KnexReview e KnexAI ajudam a traduzir, resumir e triar artigos; KnexSearch encontra conteúdos em poucos cliques.",
    },
    {
      title: "Acompanhe resultados e ajuste caminhos",
      body: "VioAnalytics mostra engajamento em vídeo, KnexFlow organiza tarefas e fluxos, e os times tomam decisões com dados.",
    },
  ];

  return (
    <section className="bg-[var(--kx-bg)] pt-6 pb-12">
      <div className="mx-auto max-w-6xl space-y-6 px-4 md:px-6">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Como o Knexspace One se encaixa no seu dia a dia</h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Fluxo simples para criar, transmitir, organizar e analisar conteúdos em uma única suíte, com IA apoiando cada
            etapa.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {steps.map((step, index) => {
            const isActive = activeIndex === index;
            return (
              <button
                key={step.title}
                type="button"
                onClick={() => setActiveIndex(isActive ? null : index)}
                className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition ${
                  isActive
                    ? "border-2 border-[color:var(--kx-primary)] ring-1 ring-[color:var(--kx-primary)] ring-opacity-30"
                    : "border-slate-200 hover:-translate-y-0.5 hover:shadow-md"
                }`}
                aria-expanded={isActive}
              >
                <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                {isActive ? (
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
