import * as Toast from "@radix-ui/react-toast"
import { useState } from "react"

export function Toaster() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string>("")
  ;(window as any).toast = (msg: string) => {
    setMessage(msg)
    setOpen(true)
  }
  return (
    <Toast.Provider>
      <Toast.Root open={open} onOpenChange={setOpen} className="fixed bottom-4 right-4 rounded border bg-background p-3 shadow">
        <Toast.Title className="text-sm font-medium">Notification</Toast.Title>
        <Toast.Description className="text-xs text-muted-foreground">{message}</Toast.Description>
      </Toast.Root>
      <Toast.Viewport />
    </Toast.Provider>
  )
}

export default Toaster


