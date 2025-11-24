"use client";

import { useState } from "react";

const FAQ_ITEMS = [
  {
    q: "O KnexIT Workspace substitui meu AVA atual?",
    a: "Ele pode complementar ou substituir, oferecendo aulas gravadas, lives, documentos, tarefas e IA integrados. A decisao depende do seu modelo.",
  },
  {
    q: "Preciso instalar algo nos computadores dos alunos?",
    a: "Nao. Tudo roda no navegador. Para lives, basta ter camera e microfone liberados.",
  },
  {
    q: "Qual a diferenca entre os planos Starter, Pro, Plus e Enterprise?",
    a: "Os planos escalam em armazenamento, recursos de video/analytics, limites de IA e governanca. Enterprise inclui suporte dedicado e integracoes avancadas.",
  },
  {
    q: "Posso comecar com apenas um produto e depois migrar para o Workspace completo?",
    a: "Sim. Voce pode adotar um produto e depois habilitar os demais mantendo a mesma base de usuarios e permissao.",
  },
  {
    q: "O KnexIT Workspace funciona em celulares?",
    a: "Sim. Interface responsiva para aulas, lives, leitura de arquivos e interacoes principais.",
  },
  {
    q: "Como funcionam os recursos de IA (KnexAI, VioRead, KnexReview)?",
    a: "Eles apoiam leitura, revisao, busca e resumo. As chamadas podem seguir limites por plano e usam provedores configurados pelo time.",
  },
];

export default function FaqSection() {
  const [open, setOpen] = useState<string | null>(FAQ_ITEMS[0]?.q ?? null);

  return (
    <section className="bg-white py-12">
      <div className="mx-auto max-w-5xl space-y-6 px-4 md:px-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-slate-900">Perguntas frequentes</h2>
          <p className="text-lg text-slate-600">Destaques sobre operacao, adocao e uso combinado com IA.</p>
        </div>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => {
            const isOpen = open === item.q;
            return (
              <div
                key={item.q}
                className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${isOpen ? "bg-slate-50" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : item.q)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-base font-semibold text-slate-900">{item.q}</span>
                  <span className="text-slate-500">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen ? <p className="mt-3 text-sm text-slate-700 leading-relaxed">{item.a}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
