import { PropsWithChildren } from "react"
import { Link, NavLink } from "react-router-dom"

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b px-4 py-3">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link to="/" className="font-semibold">Sentinel</Link>
          <nav className="text-sm text-muted-foreground flex gap-4">
            <NavLink to="/dashboard" className={({isActive}) => isActive ? "text-foreground" : undefined}>Dashboard</NavLink>
            <NavLink to="/" className={({isActive}) => isActive ? "text-foreground" : undefined}>Alerts</NavLink>
            <NavLink to="/evals" className={({isActive}) => isActive ? "text-foreground" : undefined}>Evals</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  )
}

export default AppShell


