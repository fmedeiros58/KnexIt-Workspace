import Link from "next/link";

export default function VioClassPage() {
  const problems = [
    "Centralizar trilhas de aulas e materiais sem depender de ferramentas soltas.",
    "Manter videoaulas, materiais e avaliacao no mesmo fluxo.",
    "Acompanhar progresso e engajamento de turmas em tempo real.",
  ];

  const features = [
    "Trilhas de aulas com video, textos e materiais anexados.",
    "Envio de apostilas, slides e atividades direto pelo navegador.",
    "Avaliacoes e acompanhamento de progresso por turma ou aluno.",
    "Areas para comentarios e interacao entre alunos e instrutores.",
    "Relatorios resumidos para coordenacao pedagogica.",
  ];

  const audiences = ["Professores e tutores", "Coordenacao de curso", "Equipes pedagogicas", "Instituicoes de ensino"];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">VioClass</h1>
          <p className="text-lg text-slate-700">
            Plataforma de cursos e aulas em video para organizar trilhas, materiais e avaliacao em um unico lugar.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">O que o VioClass resolve</h2>
          <p className="text-base text-slate-700">
            Cria um ambiente completo para publicar conteudos, gerenciar turmas e acompanhar o progresso com clareza.
          </p>
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
