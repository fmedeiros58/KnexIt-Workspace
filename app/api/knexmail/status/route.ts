import { NextResponse } from "next/server";
import { getActiveMailProvider } from "@/lib/knexmail/providerRegistry";

export async function GET() {
  const provider = getActiveMailProvider(process.env);
  return NextResponse.json({ provider: provider?.id || null, configured: !!provider });
}
