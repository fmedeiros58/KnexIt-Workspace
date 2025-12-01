import Link from "next/link";

export default function FinalCtaSection() {
  return (
    <section id="contato" className="bg-slate-50 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-indigo-50 p-6 text-center shadow-sm">
        <h2 className="text-3xl font-bold text-slate-900">Pronto para conectar aulas, arquivos e IA em um so lugar?</h2>
        <p className="mt-3 text-base text-slate-700">
          Fale com o time para alinhar necessidades da sua instituicao ou revise os planos e comece agora mesmo.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="mailto:contato@exemplo.com"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold shadow-sm"
          >
            Falar com o time
          </Link>
          <Link
            href="#planos"
            className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 px-6 py-3 rounded-xl font-semibold"
          >
            Ver planos novamente
          </Link>
        </div>
      </div>
    </section>
  );
}
