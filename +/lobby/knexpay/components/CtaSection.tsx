import Link from "next/link";
import ProductAppLink from "../../../knexpay/components/ProductAppLink";
import { content } from "./content";

export default function CtaSection() {
  return (
    <section id="cta" className="py-14 bg-white">
      <div className="mx-auto max-w-4xl text-center space-y-4">
        <h2 className="text-3xl font-bold text-slate-900">Pronto para usar o {content.title}?</h2>
        <p className="text-lg text-slate-600">
          Acesse direto com sua conta KnexIT. Se precisar de mais detalhes de marketing, visite a página de branding.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <ProductAppLink slug={content.slug} label={content.ctaLabel ?? "Acessar produto"} />
          <Link
            href={`/branding/${content.slug}`}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-50"
          >
            Ver branding
          </Link>
        </div>
      </div>
    </section>
  );
}

