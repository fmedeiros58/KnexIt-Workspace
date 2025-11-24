import { NextResponse } from "next/server";
import { listLogs } from "@/lib/knexmail/store";

export async function GET() {
  return NextResponse.json({ logs: listLogs() });
}
