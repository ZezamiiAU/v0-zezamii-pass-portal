import { createBrowserClient } from "@supabase/ssr"

let browserClient = null

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[v0] Supabase environment variables not configured")
    // Return a mock client that will fail gracefully
    return {
      auth: {
        signInWithPassword: async () => ({
          data: { user: null, session: null },
          error: new Error("Supabase not configured"),
        }),
        signOut: async () => ({ error: null }),
        getUser: async () => ({ data: { user: null }, error: new Error("Supabase not configured") }),
        getSession: async () => ({ data: { session: null }, error: new Error("Supabase not configured") }),
      },
    }
  }

  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }
  return browserClient
}
