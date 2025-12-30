import { redirect } from "next/navigation"

/**
 * Admin Panel Index Page
 * Redirects to /admin/logs (default view)
 */
export default function AdminPage() {
  redirect("/admin/logs")
}
