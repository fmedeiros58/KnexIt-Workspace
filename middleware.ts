import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function isKnexchatDevHost(host: string | null) {
  if (!host) return false;
  const normalizedHost = host.toLowerCase();
  return (
    normalizedHost === "localhost:3850" ||
    normalizedHost === "127.0.0.1:3850" ||
    normalizedHost === "[::1]:3850"
  );
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/" && isKnexchatDevHost(request.headers.get("host"))) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/knexchat/web";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};

