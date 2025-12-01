export default function SecuritySection() {
  const bullets = [
    "Acesso organizado por cursos, turmas e perfis de usuario.",
    "Dados trafegam em conexoes seguras com boas praticas padrao.",
    "Controles administrativos para reduzir acessos indevidos a informacoes sensiveis.",
  ];

  return (
    <section className="bg-white py-12">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-slate-50 p-6 px-5 md:px-8 shadow-sm">
        <h2 className="text-3xl font-bold text-slate-900">Seguranca e controle pensados para instituicoes</h2>
        <p className="mt-3 text-base text-slate-700">
          Estrutura criada para perfis de aluno, professor e coordenacao, com controle de permissao por conteudo e turma.
          Segue praticas modernas de seguranca sem expor detalhes sensiveis.
        </p>
        <ul className="mt-4 space-y-2 text-slate-700">
          {bullets.map((item) => (
            <li key={item} className="flex gap-2 text-sm">
              <span className="text-indigo-600">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
