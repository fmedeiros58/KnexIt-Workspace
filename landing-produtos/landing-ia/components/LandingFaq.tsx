const faqs = [
  {
    question: "Quais recursos estão incluídos?",
    answer:
      "A landing é flexível: você escolhe quais módulos e integrações ativar.",
  },
  {
    question: "Como funciona a implantação?",
    answer:
      "A equipe acompanha a ativação e define um plano de adoção por área.",
  },
  {
    question: "Existe teste ou piloto?",
    answer:
      "Sim, podemos liberar um piloto controlado com usuários-chave.",
  },
];

export default function LandingFaq() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-16">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
        <h2 className="text-2xl font-semibold text-slate-900">Perguntas frequentes</h2>
        <div className="mt-6 grid gap-4">
          {faqs.map((item) => (
            <div key={item.question} className="border-b border-slate-200 pb-4">
              <p className="text-sm font-semibold text-slate-900">{item.question}</p>
              <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
