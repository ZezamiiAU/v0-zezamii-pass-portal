"use client"

const MOCK_AUTH_KEY = "mock-auth-session"
const MOCK_USER_KEY = "mock-user"

export interface MockUser {
  id: string
  email: string
  created_at: string
}

export function mockSignIn(email: string): MockUser {
  const user: MockUser = {
    id: crypto.randomUUID(),
    email,
    created_at: new Date().toISOString(),
  }

  localStorage.setItem(MOCK_AUTH_KEY, "true")
  localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user))

  return user
}

export function mockSignUp(email: string): MockUser {
  return mockSignIn(email) // Same as sign in for mock
}

export function mockSignOut() {
  localStorage.removeItem(MOCK_AUTH_KEY)
  localStorage.removeItem(MOCK_USER_KEY)
}

export function getMockSession(): { user: MockUser } | null {
  if (typeof window === "undefined") return null

  const isAuthenticated = localStorage.getItem(MOCK_AUTH_KEY)
  const userStr = localStorage.getItem(MOCK_USER_KEY)

  if (isAuthenticated === "true" && userStr) {
    return { user: JSON.parse(userStr) }
  }

  return null
}

export function getMockUser(): MockUser | null {
  const session = getMockSession()
  return session?.user || null
}
