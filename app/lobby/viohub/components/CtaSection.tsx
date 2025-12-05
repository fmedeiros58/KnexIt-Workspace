import ProductAppLink from "../../../viohub/components/ProductAppLink";
import { content } from "./content";

export default function CtaSection() {
  return (
    <section className="bg-gradient-to-r from-orange-600 to-orange-500 text-white">
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">Pronto para pilotar o VioHub?</h3>
          <p className="text-sm text-white/90">
            Conecte seu fluxo de produção de vídeo com armazenamento, revisão e publicação em um só lugar.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ProductAppLink slug={content.slug} label={content.ctaLabel ?? "Acessar produto"} />
        </div>
      </div>
    </section>
  );
}
