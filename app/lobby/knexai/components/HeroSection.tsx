import Link from "next/link";
import ProductAppLink from "../../../knexai/components/ProductAppLink";
import { content } from "./content";

export default function HeroSection() {
  return (
    <section className="bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-16 pt-12 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="space-y-4 md:w-1/2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-600">Produto</p>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight text-slate-900">{content.title}</h1>
          <p className="text-lg text-slate-700">{content.headline}</p>
          <p className="text-base text-slate-600">{content.intro}</p>
          <div className="flex flex-wrap gap-3">
            <ProductAppLink slug={content.slug} label={content.ctaLabel ?? "Acessar produto"} />
            <Link
              href={`/branding/${content.slug}`}
              className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 px-6 py-3 rounded-xl font-semibold"
            >
              Ver branding
            </Link>
          </div>
        </div>

        <div className="md:w-1/2">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Pronto para começar</div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Disponível</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-indigo-50/60 p-4 space-y-2 text-sm text-slate-700 leading-relaxed">
              <p>Este lobby leva você ao produto completo. Se não estiver logado, faremos o redirecionamento para login.</p>
              <p className="font-semibold text-slate-900">Dica:</p>
              <p>Use o botão “Acessar produto” para entrar direto; o branding traz mais detalhes.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

