import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="bg-[#E5F3F4]">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-16 pt-12 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="space-y-4 md:w-[40%]">
          {/* Icons removed per request */}

          <h1 className="text-center text-4xl font-bold leading-tight text-black md:text-left md:text-5xl">
            Veja sua instituição ir mais longe com o Knexspace One
          </h1>

          <p className="text-center text-lg text-slate-700 md:text-left">
            Suíte integrada para aulas, lives, arquivos, IA e colaboração.
            Crie, organize e compartilhe tudo em um só lugar com segurança e
            escala.
          </p>

          <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
            <Link
              href="/knexit-workspace/acesso?stay=1"
              className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-xl bg-[#3E8FA3] px-6 py-3 text-sm font-semibold text-white shadow-sm no-underline hover:bg-[#337E91] hover:no-underline"
            >
              Iniciar agora
            </Link>
            <Link
              href="#planos"
              className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 no-underline hover:bg-slate-50 hover:no-underline"
            >
              Ver planos
            </Link>
          </div>
        </div>

        <div className="md:w-[60%]">
          <img
            src="/knexit-workspace/knexspace-one-hero.svg"
            alt="Ecossistema Knexspace One"
            className="h-auto w-full"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
