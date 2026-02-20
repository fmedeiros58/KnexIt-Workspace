import Link from "next/link";

const APP_BASE = process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, "") ?? "";

export default function ProductAppLink({ slug, label }: { slug: string; label?: string }) {
  const href = APP_BASE ? `${APP_BASE}/${slug}` : `/${slug}`;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-500"
    >
      {label ?? "Acessar produto"}
    </Link>
  );
}
