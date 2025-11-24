import { NextResponse } from "next/server";
import type { VioReadDocument } from "../../../../../vioread/web/lib/vioreadTypes";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as
    | { document: VioReadDocument; sourceLang: string; targetLang: string }
    | null;

  if (!body?.document) {
    return NextResponse.json({ error: "Documento ausente" }, { status: 400 });
  }

  const { document, targetLang } = body;
  const translated: VioReadDocument = {
    ...document,
    id: `${document.id}-translated-${targetLang}`,
    language: targetLang,
    sections: document.sections.map((sec) => ({
      ...sec,
      blocks: sec.blocks.map((b) => ({
        ...b,
        text: `[[TRADUZIDO ${targetLang}]] ${b.text}`,
        items: b.items?.map((it) => `[[TRADUZIDO ${targetLang}]] ${it}`),
      })),
    })),
  };

  return NextResponse.json({ document: translated });
}
