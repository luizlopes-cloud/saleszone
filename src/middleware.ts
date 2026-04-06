import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Rotas do Audit MQL são públicas (Meta webhook + cron endpoints)
  if (request.nextUrl.pathname.startsWith("/api/growth/audit-mql/")) {
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|invite|auth/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
