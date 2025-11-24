import Link from "next/link";

export default function VioRecordPage() {
  const problems = [
    "Gravar videoaulas, tutoriais ou demonstracoes sem instalar softwares pesados.",
    "Organizar gravacoes para publicar rapidamente no VioClass ou SupaDrive.",
    "Padronizar a qualidade de audio e video para aulas online.",
  ];

  const features = [
    "Gravacao de tela, webcam e microfone direto no navegador.",
    "Exportacao simples para VioClass, SupaDrive ou compartilhamento via link.",
    "Opcoes basicas de cortes e revisao rapida.",
    "Captura com configuracoes salvas para repetir o mesmo setup.",
  ];

  const audiences = ["Professores e tutores", "Instrutores corporativos", "Equipes de conteudo e midia", "Times de suporte e treinamento"];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-12 space-y-10">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold">VioRecord</h1>
          <p className="text-lg text-slate-700">
            Gravacao de tela e webcam no navegador para criar aulas, tutoriais e demonstracoes sem friccao.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-slate-900">O que o VioRecord resolve</h2>
          <p className="text-base text-slate-700">Simplifica a captura de conteudo para que professores publiquem rapido em suas turmas.</p>
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
