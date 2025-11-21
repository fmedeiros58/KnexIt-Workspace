"use client";

import Link from "next/link";

type FooterProps = {
  brand?: string;                  // nome que aparece no ©
  privacyHref?: string;            // "/privacy"
  termsHref?: string;              // "/terms"
  cookiesHref?: string;            // "/cookies"
  email?: string;                  // contato opcional
  whatsapp?: string;               // ex.: "https://wa.me/5599999999999"
  showContact?: boolean;           // mostra/oculta bloco de contato
  className?: string;              // classes extras se quiser
};

export default function Footer({
  brand = "KNEXIT",
  privacyHref = "/privacy",
  termsHref = "/terms",
  cookiesHref = "/cookies",
  email,
  whatsapp,
  showContact = false,
  className = "",
}: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={[
        "border-t border-slate-200 bg-white/80 backdrop-blur",
        className,
      ].join(" ")}
    >
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          {/* Esquerda: © e marca */}
          <div className="text-sm text-slate-600">
            © {year} {brand} — Todos os direitos reservados.
          </div>

          {/* Centro: navegação legal */}
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link href={privacyHref} className="text-slate-600 hover:text-slate-900 hover:underline">
              Política de Privacidade
            </Link>
            <Link href={termsHref} className="text-slate-600 hover:text-slate-900 hover:underline">
              Termos de Uso
            </Link>
            <Link href={cookiesHref} className="text-slate-600 hover:text-slate-900 hover:underline">
              Política de Cookies
            </Link>
          </nav>

          {/* Direita: contato (opcional) */}
          {showContact && (
            <div className="text-sm text-slate-600 flex items-center gap-4">
              {email && (
                <a href={`mailto:${email}`} className="hover:underline">
                  {email}
                </a>
              )}
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noreferrer" className="hover:underline">
                  WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
