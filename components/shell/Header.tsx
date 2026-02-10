import type { ReactNode } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

type HeaderProps = {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
  menuOpen?: boolean;
  rightSlot?: ReactNode;
  bottomSlot?: ReactNode;
};

export default function Header({
  title,
  subtitle,
  onMenuClick,
  menuOpen = false,
  rightSlot,
  bottomSlot,
}: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex flex-col border-b border-slate-200/70 bg-[#3E8FA3] text-slate-900 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex min-h-[3.85rem] items-center justify-between gap-3 px-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/15 md:hidden"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="min-w-0">
            {title === "Knexspace One" ? (
              <Link href="/knexit-workspace" aria-label="Ir para a página principal">
                <img
                  src="/brand/knexspace-one.svg"
                  alt="Knexspace One"
                  className="h-[34px] w-auto"
                />
              </Link>
            ) : (
              <p className="truncate text-[26px] font-semibold">{title}</p>
            )}
            {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{rightSlot}</div>
      </div>
      {bottomSlot ? bottomSlot : null}
    </header>
  );
}
