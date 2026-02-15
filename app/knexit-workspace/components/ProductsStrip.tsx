import Link from "next/link";
import ProductIcon from "./ProductIcon";
import {
  CATEGORY_LABEL,
  PRODUCT_CARD_COLORS,
  WORKSPACE_PRODUCTS,
} from "./productsData";

const CARD_COLORS = PRODUCT_CARD_COLORS;

export default function ProductsStrip() {
  return (
    <section id="produtos" className="bg-[var(--kx-bg)] py-14">
      <div className="mx-auto max-w-6xl px-4 md:px-6 space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-bold text-slate-900">O Knexspace One inclui:</h2>
          <p className="text-lg text-slate-600">
            Ecossistema integrado para aulas, lives, arquivos, colaboração, automação e IA, com métricas e segurança para
            escalar sua instituição.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 justify-items-center">
          {WORKSPACE_PRODUCTS.map((p, idx) => {
            const color = CARD_COLORS[idx] ?? CARD_COLORS[CARD_COLORS.length - 1];
            return (
          <Link
            key={p.id}
            href={`/branding/${p.slug}`}
            className="group w-full rounded-2xl border-2 border-[var(--card-color)] p-4 shadow-md transition transform hover:-translate-y-2 hover:scale-[1.02] hover:ring-2 hover:ring-white/70 hover:border-black flex flex-col items-center gap-2 text-center text-white no-underline hover:no-underline focus:no-underline"
            style={{ backgroundColor: color, ["--card-color" as string]: color }}
          >
            <ProductIcon icon={p.icon} className="shadow-sm" />
            <div className="h-5 max-w-full truncate text-sm font-semibold leading-5 text-white drop-shadow-sm">
              {p.name}
            </div>
            <div className="text-xs text-white/90 leading-relaxed">{p.description}</div>
            <span className="mt-1 inline-flex w-fit rounded-full bg-white/20 px-2 py-0.5 text-[11px] text-white group-hover:bg-white/30">
              {CATEGORY_LABEL[p.category]}
            </span>
          </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
