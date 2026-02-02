import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Check if Supabase env vars are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // If env vars not available, skip auth check and allow request to proceed
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  // Skip auth check for webhook and cron endpoints (they use their own auth via Authorization header)
  if (
    request.nextUrl.pathname.startsWith("/api/v1/webhooks") ||
    request.nextUrl.pathname.startsWith("/api/v1/cron") ||
    request.nextUrl.pathname.startsWith("/api/webhooks") // Legacy path support
  ) {
    return supabaseResponse
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // No user session - redirect to login for protected routes
    if (!user && !request.nextUrl.pathname.startsWith("/auth") && request.nextUrl.pathname !== "/") {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (error) {
    // On error, redirect to login rather than showing error page
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }
}
