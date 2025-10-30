import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"

export function Dialog({ open, onOpenChange, children }: { open?: boolean; onOpenChange?(o: boolean): void; children: React.ReactNode }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  )
}

export function DialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-black/30" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-md border bg-background p-4 shadow-lg outline-none",
          className
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between border-b pb-2 mb-3">{children}</div>
}


