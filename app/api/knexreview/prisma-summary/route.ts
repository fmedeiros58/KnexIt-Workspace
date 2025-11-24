import { NextResponse } from "next/server";

export async function GET() {
  // TODO: puxar contagens reais do backend/Supabase
  return NextResponse.json({
    identified: 120,
    afterDedup: 95,
    afterScreening: 45,
    included: 18,
  });
}
