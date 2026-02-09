import Link from "next/link";

export default function ProdutosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#eef2f7] text-slate-900">
      {children}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© KnexIT Workspace</span>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/knexit-workspace/precos"
              className="no-underline transition hover:text-slate-900"
            >
              Planos e preços
            </Link>
            <Link
              href="/knexit-workspace/acesso"
              className="no-underline transition hover:text-slate-900"
            >
              Contato comercial
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
