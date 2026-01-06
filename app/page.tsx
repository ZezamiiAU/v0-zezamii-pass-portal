import { redirect } from "next/navigation"

// Redirect directly to the public request pass page
export default function HomePage() {
  redirect("/request-pass")
}
