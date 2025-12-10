import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export async function proxy(request: NextRequest) {
  // Just pass through all requests - auth is handled client-side with mock auth
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
