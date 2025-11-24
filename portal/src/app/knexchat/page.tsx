import Link from "next/link";

export default function KnexChatPage() {
  const problems = [
    "Conversas dispersas entre apps diferentes e sem contexto com aulas.",
    "Dificuldade de segmentar mensagens por turma, projeto ou time.",
    "Falta de registro claro de decisoes e combinados.",
  ];

  const features = [
    "Canais por turma, curso, projeto ou time.",
    "Mensagens diretas e mencoes para acionar pessoas rapidamente.",
    "Compartilhamento de arquivos do SupaDrive e links de aulas do VioClass.",
    "Historico acessivel com busca simples.",
  ];

  const audiences = ["Alunos e professores", "Monitores e tutores", "Equipes de apoio e administracao"];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">KnexChat</h1>
          <p className="text-lg text-slate-700">Chat interno para turmas, times e projetos, com integracao aos demais apps da suite.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">O que o KnexChat resolve</h2>
          <p className="text-base text-slate-700">Cria um canal unico de comunicacao, com contexto e historico, evitando dispersao em apps externos.</p>
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
          <h2 className="text-2xl font-semibold text-slate-900">Para quem é</h2>
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
