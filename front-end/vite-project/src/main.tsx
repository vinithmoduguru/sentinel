import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import AppShell from "./layouts/AppShell"
import AlertsPage from "./pages/Alerts"
import DashboardPage from "./pages/Dashboard"
import Toaster from "./components/ui/toaster"
import CustomerPage from "./pages/Customer"
import EvalsPage from "./pages/Evals"

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AppShell>
        <AlertsPage />
      </AppShell>
    ),
  },
  {
    path: "/dashboard",
    element: (
      <AppShell>
        <DashboardPage />
      </AppShell>
    ),
  },
  {
    path: "/customer/:id",
    element: (
      <AppShell>
        <CustomerPage />
      </AppShell>
    ),
  },
  {
    path: "/evals",
    element: (
      <AppShell>
        <EvalsPage />
      </AppShell>
    ),
  },
])

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster />
  </StrictMode>
)
