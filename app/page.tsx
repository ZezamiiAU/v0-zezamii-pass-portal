import { redirect } from "next/navigation"

// Redirect to dashboard (middleware will redirect to login if not authenticated)
export default function HomePage() {
  redirect("/dashboard")
}
