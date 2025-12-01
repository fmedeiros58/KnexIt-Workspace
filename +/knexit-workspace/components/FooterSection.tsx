export default function FooterSection() {
  return (
    <footer className="bg-slate-900 text-slate-200">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="text-lg font-bold">KnexIT Workspace</div>
          <p className="text-sm text-slate-400">Suite de aulas, arquivos, IA e colaboração.</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <a href="/branding" className="hover:text-white">
            Branding
          </a>
          <a href="/lobby" className="hover:text-white">
            Lobbies
          </a>
          <a href="#planos" className="hover:text-white">
            Planos
          </a>
          <a href="#contato" className="hover:text-white">
            Contato
          </a>
        </div>
      </div>
      <div className="border-t border-slate-800 bg-slate-950 text-xs text-slate-500">
        <div className="mx-auto max-w-6xl px-4 py-3 md:px-6 flex items-center justify-between">
          <span>© {new Date().getFullYear()} KnexIT. Todos os direitos reservados.</span>
          <div className="flex gap-3">
            <a href="/privacy" className="hover:text-white">
              Privacidade
            </a>
            <a href="/terms" className="hover:text-white">
              Termos
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
