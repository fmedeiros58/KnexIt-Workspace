import type { ReactNode } from "react";

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="w-full border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 font-semibold">Admin Console</div>
      </header>
      <div className="w-full">{children}</div>
    </div>
  );
}
