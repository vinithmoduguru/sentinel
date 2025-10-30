import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"

export function Sheet({ open, onOpenChange, children }: { open?: boolean; onOpenChange?(o: boolean): void; children: React.ReactNode }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  )
}

export function SheetContent({ side = "right", className, children }: { side?: "right" | "left"; className?: string; children: React.ReactNode }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-black/30" />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-0 h-full w-full max-w-xl bg-background border-l outline-none",
          side === "right" ? "right-0" : "left-0",
          className
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function SheetHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between border-b p-4">{children}</div>
}


