// app/(no-nav)/upconect/sala/[code]/page.tsx
import SalaClient from "@/components/upconect/SalaClient";

type QS = Record<string, string | string[] | undefined>;

export default async function Page({
  params,
  searchParams,
}: {
  // Em versões recentes do Next, params/searchParams podem vir como Promises
  params: Promise<{ code: string }>;
  searchParams: Promise<QS>;
}) {
  // Desembrulha server-side (sem hooks)
  const { code: paramCode } = await params;
  const sp = (await searchParams) ?? {};

  // saneia o segmento [code]
  const isBad = (v?: string) => !v || v === "undefined" || v === "null";

  const qsCode = typeof sp.code === "string" ? sp.code.trim() : "";

  // escolhe um código seguro para usar na UI (sem redirecionar)
  const safeCode = !isBad(paramCode) ? paramCode : qsCode || "temp";

  // ?name=... (opcional; só para o badge)
  const raw = sp.name;
  const meetingName = typeof raw === "string" ? decodeURIComponent(raw) : "";

  return (
    <>
      {/* O SalaClient/Layout decide se mostra lobby ou palco com base em ?joined=1, camOn, micOn etc. */}
      <SalaClient code={safeCode} name={meetingName} />

      {/* badge fixo inferior-esquerdo */}
      <div className="fixed left-4 bottom-4 z-[60] pointer-events-none">
        <div className="inline-flex flex-col gap-0.5 rounded-xl bg-black/80 text-white px-3 py-2 ring-1 ring-white/10">
          {meetingName ? (
            <div className="text-xs sm:text-sm font-semibold leading-tight">
              {meetingName}
            </div>
          ) : null}
          <div className="text-[11px] sm:text-xs text-slate-300 leading-tight">
            Código:&nbsp;<span className="font-mono text-white">{safeCode}</span>
          </div>
        </div>
      </div>
    </>
  );
}
