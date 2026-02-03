import type { LucideIcon } from "lucide-react";
import {
  AppWindow,
  Folder,
  MessageCircle,
  Mail,
  LayoutGrid,
  Search,
  FileText,
  CreditCard,
  Sparkles,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Knexspace", href: "/knexit-workspace", icon: AppWindow },
  { label: "KnexChat", href: "/knexchat/web", icon: MessageCircle },
  { label: "Supadrive", href: "/supadrive/web", icon: Folder },
  { label: "KnexMail", href: "/knexmail/web", icon: Mail },
  { label: "KnexFlow", href: "/knexflow/web", icon: LayoutGrid },
  { label: "KnexDocs", href: "/knexdocs/web", icon: FileText },
  { label: "KnexSearch", href: "/knexsearch/web", icon: Search },
  { label: "KnexPay", href: "/knexpay/web", icon: CreditCard },
  { label: "KnexAI", href: "/knexai/web", icon: Sparkles },
];

export const getActiveNavItem = (pathname: string | null, items = NAV_ITEMS) => {
  if (!pathname) return items[0] ?? null;
  return (
    items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ??
    items[0] ??
    null
  );
};
