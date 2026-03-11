"use client";

import { useEffect, useState } from "react";

export type SettingsSectionKey =
  | "geral"
  | "notificacoes"
  | "personalizacao"
  | "aplicativos"
  | "agendamentos"
  | "dados"
  | "seguranca"
  | "parental"
  | "conta";

type SettingsFloatingModalProps = {
  open: boolean;
  onClose: () => void;
  initialSection?: SettingsSectionKey;
};

type SettingsSection = {
  key: SettingsSectionKey;
  label: string;
};

const SETTINGS_SECTIONS: SettingsSection[] = [
  { key: "geral", label: "Geral" },
  { key: "notificacoes", label: "Notificacoes" },
  { key: "personalizacao", label: "Personalizacao" },
  { key: "aplicativos", label: "Aplicativos" },
  { key: "agendamentos", label: "Agendamentos" },
  { key: "dados", label: "Controlar dados" },
  { key: "seguranca", label: "Seguranca" },
  { key: "parental", label: "Controles parentais" },
  { key: "conta", label: "Conta" },
];

export default function SettingsFloatingModal({
  open,
  onClose,
  initialSection = "geral",
}: SettingsFloatingModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>(initialSection);

  useEffect(() => {
    if (!open) return;
    setActiveSection(initialSection);
  }, [initialSection, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/35 p-4" onClick={onClose}>
      <div
        className="flex h-[min(92vh,760px)] w-[min(96vw,980px)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_-45px_rgba(15,23,42,0.7)]"
        onClick={(event) => event.stopPropagation()}
      >
        <aside className="w-[252px] shrink-0 border-r border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:bg-white"
              aria-label="Fechar ajustes"
            >
              <CloseIcon />
            </button>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ajustes</span>
            <span className="h-7 w-7" />
          </div>

          <nav className="space-y-1">
            {SETTINGS_SECTIONS.map((section) => {
              const active = section.key === activeSection;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    active
                      ? "bg-white font-semibold text-slate-900 shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  <SettingsDotIcon />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto bg-white p-6">
          <h2 className="text-[34px] leading-9 font-semibold text-slate-900">{resolveSectionTitle(activeSection)}</h2>
          <div className="mt-4 h-px bg-slate-200" />

          {activeSection === "geral" ? <GeneralSection /> : <PlaceholderSection section={activeSection} />}
        </section>
      </div>
    </div>
  );
}

function resolveSectionTitle(section: SettingsSectionKey): string {
  if (section === "geral") return "Geral";
  if (section === "notificacoes") return "Notificacoes";
  if (section === "personalizacao") return "Personalizacao";
  if (section === "aplicativos") return "Aplicativos";
  if (section === "agendamentos") return "Agendamentos";
  if (section === "dados") return "Controlar dados";
  if (section === "seguranca") return "Seguranca";
  if (section === "parental") return "Controles parentais";
  return "Conta";
}

function GeneralSection() {
  return (
    <div className="mt-6 space-y-5">
      <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-700">
              <LockIcon />
            </span>
            <div>
              <p className="text-[31px] leading-8 font-semibold text-slate-900">Proteja sua conta</p>
              <p className="mt-2 text-sm text-slate-600">
                Adicione autenticacao multifatorial (MFA) para reforcar o acesso ao ambiente.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Configurar MFA
              </button>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-slate-600"
            aria-label="Fechar aviso de protecao"
          >
            <CloseIcon />
          </button>
        </div>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-[31px] leading-8 font-semibold text-slate-900">Aparencia</h3>
        <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          <SettingRow label="Aparencia" value="Sistema" />
          <SettingRow label="Cor de enfase" value="Padrao" />
          <SettingRow label="Idioma" value="Autodetectar" />
        </div>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-[31px] leading-8 font-semibold text-slate-900">Restricoes Superadmin</h3>
        <p className="mt-3 text-sm text-slate-600">
          O controle de memoria compartilhada foi movido para este modal dentro do chat.
        </p>
        <button
          type="button"
          className="mt-4 inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Abrir controlar dados
        </button>
      </article>
    </div>
  );
}

function PlaceholderSection({ section }: { section: SettingsSectionKey }) {
  return (
    <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6">
      <p className="text-[31px] leading-8 font-semibold text-slate-900">{resolveSectionTitle(section)}</p>
      <p className="mt-3 text-sm text-slate-600">
        Esta secao estara disponivel neste modal em seguida.
      </p>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between px-4 py-4 text-left text-sm text-slate-700 transition hover:bg-slate-50"
    >
      <span>{label}</span>
      <span className="inline-flex items-center gap-2 text-slate-500">
        {value}
        <ChevronDownIcon />
      </span>
    </button>
  );
}

function SettingsDotIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.3" fill="currentColor" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M6 9l6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
