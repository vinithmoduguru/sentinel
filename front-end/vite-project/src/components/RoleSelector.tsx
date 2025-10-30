import { useState, useEffect } from "react"
import { Shield, User } from "lucide-react"

type Role = "agent" | "lead" | null

const AGENT_KEY = "agent_secret_123"
const LEAD_KEY = "lead_secret_456"

export function RoleSelector() {
  const [currentRole, setCurrentRole] = useState<Role>(() => {
    return (localStorage.getItem("sentinel_role") as Role) || null
  })

  useEffect(() => {
    if (currentRole) {
      localStorage.setItem("sentinel_role", currentRole)
      const apiKey = currentRole === "agent" ? AGENT_KEY : LEAD_KEY
      localStorage.setItem("sentinel_api_key", apiKey)
    } else {
      localStorage.removeItem("sentinel_role")
      localStorage.removeItem("sentinel_api_key")
    }
  }, [currentRole])

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Role:</span>
      <div className="flex rounded-md border overflow-hidden">
        <button
          onClick={() => setCurrentRole("agent")}
          className={`px-3 py-1 text-xs flex items-center gap-1.5 transition-colors ${
            currentRole === "agent"
              ? "bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted"
          }`}
          title="Agent role - requires OTP for sensitive actions">
          <User className="h-3 w-3" />
          Agent
        </button>
        <button
          onClick={() => setCurrentRole("lead")}
          className={`px-3 py-1 text-xs flex items-center gap-1.5 transition-colors border-l ${
            currentRole === "lead"
              ? "bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted"
          }`}
          title="Lead role - can bypass OTP requirements">
          <Shield className="h-3 w-3" />
          Lead
        </button>
      </div>
      {currentRole && (
        <span className="text-xs text-muted-foreground">
          ({currentRole === "agent" ? "Standard" : "Elevated"} access)
        </span>
      )}
    </div>
  )
}

export default RoleSelector

