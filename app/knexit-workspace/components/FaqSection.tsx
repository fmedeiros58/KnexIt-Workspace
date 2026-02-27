"use client";

import { useState } from "react";

const FAQ_ITEMS = [
  {
    q: "O que está incluído no Knexspace One?",
    a: "Você recebe VioClass, VioLive, SupaDrive, KnexChat, KnexDocs, KnexFlow e a camada de IA (KnexAI, VioRead, KnexReview), com permissões e métricas centralizadas.",
  },
  {
    q: "O que é a IA do Knexspace One e como saber mais?",
    a: "A IA ajuda em leitura, revisão, busca e resumo. Você pode explorar guias práticos e exemplos no Centro de aprendizagem.",
  },
  {
    q: "Qual é o plano ideal para a minha instituição?",
    a: "Depende do número de usuários, do volume de aulas/lives e do nível de IA desejado. Os planos escalam em recursos, armazenamento e suporte.",
  },
  {
    q: "Minha instituição pode testar antes de assinar?",
    a: "Sim. Podemos habilitar um piloto com o núcleo de apps e IA para validar o fluxo e o engajamento do time.",
  },
  {
    q: "Como faço o cadastro e inicio o ambiente?",
    a: "O cadastro é feito pelo acesso do Knexspace One. Após validação do e-mail, você configura o domínio e cria os primeiros usuários.",
  },
  {
    q: "Como migrar conteúdos e permissões para o Knexspace One?",
    a: "O time de implantação ajuda a importar dados, mapear permissões e organizar pastas, turmas e canais.",
  },
];

export default function FaqSection() {
  const [open, setOpen] = useState<string | null>(FAQ_ITEMS[0]?.q ?? null);
  const [expandAll, setExpandAll] = useState(false);
  const [toggleActive, setToggleActive] = useState(false);

  return (
    <section id="faq" className="bg-[var(--kx-bg)] py-12">
      <div className="mx-auto max-w-6xl space-y-8 px-4 md:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900">Encontre as respostas que você procura</h2>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="flex items-center justify-end text-sm text-slate-500">
              <button
                type="button"
                onClick={() => {
                  setToggleActive(true);
                  if (expandAll) {
                    setExpandAll(false);
                    setOpen(null);
                  } else {
                    setExpandAll(true);
                    setOpen(null);
                  }
                }}
                onBlur={() => setToggleActive(false)}
                className={`inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold ${
                  toggleActive ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {expandAll ? "Fechar tudo" : "Abrir tudo"}
                <svg className="h-4 w-4 text-current" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M6 8 10 4 14 8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6 12 10 16 14 12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <div className="bg-transparent">
              {FAQ_ITEMS.map((item) => {
                const isOpen = expandAll || open === item.q;
                return (
                  <div
                    key={item.q}
                    className="border-b border-slate-200 px-4 py-5 last:border-b-0 lg:px-0 lg:py-6"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (expandAll) {
                          setExpandAll(false);
                          setOpen(item.q);
                          return;
                        }
                        setOpen(isOpen ? null : item.q);
                      }}
                      className="flex w-full items-center justify-between gap-4 text-left"
                    >
                      <span className="text-base font-semibold text-slate-900">{item.q}</span>
                      <svg
                        className={`h-4 w-4 text-[#2F8FA7] transition ${isOpen ? "rotate-180" : ""}`}
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 7.5 10 12.5 15 7.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    {isOpen ? <p className="mt-4 text-sm leading-relaxed text-slate-600">{item.a}</p> : null}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="inline-flex w-fit items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-[#2F8FA7] hover:border-slate-400 hover:bg-slate-100"
            >
              Veja mais perguntas frequentes
            </button>
          </div>

          <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 lg:grid-cols-1 lg:gap-4 lg:content-start lg:self-start">
            <div className="w-full rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-slate-900">Conheça o Centro de aprendizagem</h3>
              <p className="mt-2 text-sm text-slate-600">
                Encontre guias, dicas e tutoriais para começar com o Knexspace One.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-[#2F8FA7] hover:border-slate-400 hover:bg-slate-100"
              >
                Veja os recursos
              </button>
            </div>

            <div className="w-full rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-slate-900">Central de Ajuda para Administradores</h3>
              <p className="mt-2 text-sm text-slate-600">
                Acesse materiais para configurar contas, permissões e integrações com segurança.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-[#2F8FA7] hover:border-slate-400 hover:bg-slate-100"
              >
                Receba suporte
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
