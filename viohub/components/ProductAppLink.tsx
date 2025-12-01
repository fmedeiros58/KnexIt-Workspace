import Link from "next/link";

const APP_BASE = process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";

export default function ProductAppLink({ slug, label }: { slug: string; label?: string }) {
  const href = `${APP_BASE}/${slug}/web`;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-orange-500"
    >
      {label ?? "Acessar produto"}
    </Link>
  );
}
