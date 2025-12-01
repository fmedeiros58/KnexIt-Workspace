const APP_BASE = process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";

export default function ProductAppLink({ slug, label }: { slug: string; label?: string }) {
  const href = `${APP_BASE}/${slug}`;
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-500"
      rel="noreferrer"
    >
      {label ?? "Acessar produto"}
    </a>
  );
}
