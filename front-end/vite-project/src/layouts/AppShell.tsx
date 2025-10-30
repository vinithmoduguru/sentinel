import type { PropsWithChildren } from "react"
import { Link, NavLink } from "react-router-dom"
import RoleSelector from "@/components/RoleSelector"

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="border-b px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <Link to="/" className="font-semibold text-lg">
            Sentinel
          </Link>
          <div className="flex items-center gap-8">
            <nav className="text-sm text-muted-foreground flex gap-6">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  isActive ? "text-foreground font-medium" : "hover:text-foreground transition-colors"
                }>
                Dashboard
              </NavLink>
              <NavLink
                to="/"
                className={({ isActive }) =>
                  isActive ? "text-foreground font-medium" : "hover:text-foreground transition-colors"
                }>
                Alerts
              </NavLink>
              <NavLink
                to="/evals"
                className={({ isActive }) =>
                  isActive ? "text-foreground font-medium" : "hover:text-foreground transition-colors"
                }>
                Evals
              </NavLink>
            </nav>
            <RoleSelector />
          </div>
        </div>
      </header>
      <main className="flex-1 px-6 py-4">{children}</main>
    </div>
  )
}

export default AppShell
