export default function LandingSecurity() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-16">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
        <h2 className="text-2xl font-semibold text-slate-900">
          Segurança e privacidade de nível empresarial
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Privacidade</h3>
            <p className="mt-2 text-sm text-slate-600">
              Seus dados permanecem sob controle, com políticas de acesso claras
              e governança centralizada.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Segurança</h3>
            <p className="mt-2 text-sm text-slate-600">
              Camadas de proteção e monitoramento contínuo para reduzir riscos.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Compliance</h3>
            <p className="mt-2 text-sm text-slate-600">
              Suporte para requisitos regulatórios e auditorias com trilhas de
              controle completas.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
