import { useState } from "react"
import { Button } from "@/components/ui/button"
import { freezeCard, openDispute } from "@/lib/api"

type Props = { customerId: number }

export default function ActionsPanel({ customerId }: Props) {
  const [cardId, setCardId] = useState<number | "">("")
  const [otp, setOtp] = useState("")
  const [txnId, setTxnId] = useState<number | "">("")
  const [reason, setReason] = useState("10.4")
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState<any>(null)

  const headers: Record<string, string> = {}

  const doFreeze = async () => {
    if (!cardId) return
    const res = await freezeCard({ cardId: Number(cardId), otp: otp || undefined }, headers)
    setResult(res)
  }

  const doDispute = async () => {
    if (!txnId) return
    const res = await openDispute({ txnId: Number(txnId), reasonCode: reason, confirm }, headers)
    setResult(res)
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Actions</div>
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <input className="border rounded px-2 py-1 text-sm w-28" placeholder="Card ID" value={cardId} onChange={(e) => setCardId(e.target.value ? Number(e.target.value) : "")} />
          <input className="border rounded px-2 py-1 text-sm w-28" placeholder="OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
          <Button onClick={doFreeze}>Freeze Card</Button>
        </div>
        <div className="flex items-center gap-2">
          <input className="border rounded px-2 py-1 text-sm w-28" placeholder="Txn ID" value={txnId} onChange={(e) => setTxnId(e.target.value ? Number(e.target.value) : "")} />
          <input className="border rounded px-2 py-1 text-sm w-28" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> Confirm</label>
          <Button variant="secondary" onClick={doDispute}>Open Dispute</Button>
        </div>
      </div>
      {result && (
        <pre className="text-xs bg-muted/30 p-2 rounded border whitespace-pre-wrap break-words">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  )
}


