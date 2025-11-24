import Link from "next/link";

export default function VioLivePage() {
  const problems = [
    "Reunir aulas e mentorias ao vivo com links organizados por turma.",
    "Enviar convites e lembretes sem depender de varias ferramentas.",
    "Integrar lives com gravacoes e materiais para alunos que perderam a sessao.",
  ];

  const features = [
    "Salas ao vivo com compartilhamento de tela e camera.",
    "Links por turma e agendas visiveis para alunos e instrutores.",
    "Gravacao integrada para republicar no VioClass ou SupaDrive.",
    "Chat e interacao leve durante a sessao.",
    "Suporte a lembretes e convites via KnexMail (quando configurado).",
  ];

  const audiences = ["Professores e mentores", "Coordenacao de cursos", "Turmas que precisam de encontros sincronos"];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">VioLive</h1>
          <p className="text-lg text-slate-700">
            Salas ao vivo para aulas, mentorias e reunioes com alunos, integradas ao restante do KnexIT Workspace.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">O que o VioLive resolve</h2>
          <p className="text-base text-slate-700">Centraliza encontros sincronos com agendamento, links e gravações em um fluxo unico.</p>
          <ul className="list-disc space-y-2 pl-5 text-slate-700">
            {problems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">Principais recursos</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-700">
            {features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">Para quem e</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-700">
            {audiences.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <div>
          <Link
            href="/knexit-workspace"
            className="inline-flex rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500"
          >
            Voltar ao KnexIT Workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
