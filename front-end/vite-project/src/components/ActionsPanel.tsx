import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle, CreditCard, Shield, CheckCircle } from "lucide-react"
import { freezeCard, openDispute } from "@/lib/api"

type Props = { customerId: number }

export default function ActionsPanel({ customerId: _customerId }: Props) {
  const [otp, setOtp] = useState("")
  const [freezing, setFreezing] = useState(false)
  const [freezeSuccess, setFreezeSuccess] = useState(false)
  const [freezeError, setFreezeError] = useState<string | null>(null)

  const [confirm, setConfirm] = useState(false)
  const [disputing, setDisputing] = useState(false)
  const [disputeSuccess, setDisputeSuccess] = useState(false)
  const [disputeError, setDisputeError] = useState<string | null>(null)

  const currentRole = localStorage.getItem("sentinel_role")
  const hasApiKey = !!localStorage.getItem("sentinel_api_key")

  async function handleFreeze() {
    if (!hasApiKey) {
      setFreezeError(
        "Please select a role (Agent or Lead) in the header to perform actions"
      )
      return
    }
    if (!otp && currentRole === "agent") {
      setFreezeError("Please enter OTP code for verification")
      return
    }
    setFreezing(true)
    setFreezeError(null)
    setFreezeSuccess(false)
    try {
      // In a real app, you'd get the card ID from the alert/transaction context
      const result = await freezeCard({ cardId: 1, otp: otp || undefined })
      console.log("Freeze result:", result)
      setFreezeSuccess(true)
      setOtp("")
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to freeze card"
      setFreezeError(message)
    } finally {
      setFreezing(false)
    }
  }

  async function handleDispute() {
    if (!hasApiKey) {
      setDisputeError(
        "Please select a role (Agent or Lead) in the header to perform actions"
      )
      return
    }
    if (!confirm) {
      setDisputeError("Please confirm that you want to open a dispute")
      return
    }
    setDisputing(true)
    setDisputeError(null)
    setDisputeSuccess(false)
    try {
      // In a real app, you'd get the transaction ID from the alert context
      const result = await openDispute({
        txnId: 1,
        reasonCode: "10.4",
        confirm,
      })
      console.log("Dispute result:", result)
      setDisputeSuccess(true)
      setConfirm(false)
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to open dispute"
      setDisputeError(message)
    } finally {
      setDisputing(false)
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Available Actions
      </h3>

      {!hasApiKey && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
          <AlertTriangle className="h-4 w-4 inline mr-2" />
          Please select a role (Agent or Lead) in the header to enable actions
        </div>
      )}

      <div className="grid gap-3">
        {/* Freeze Card Action */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-red-600" />
              <CardTitle className="text-base">Freeze Card</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Temporarily freeze the customer's card to prevent further
              transactions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentRole === "agent" && (
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-xs">
                  OTP Verification
                </Label>
                <Input
                  id="otp"
                  placeholder="Enter OTP from customer"
                  value={otp}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setOtp(e.target.value)
                  }
                  className="h-9"
                />
              </div>
            )}
            {currentRole === "lead" && (
              <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded p-2">
                As a Lead, you can bypass OTP verification
              </p>
            )}
            {freezeSuccess && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded p-2 text-xs">
                <CheckCircle className="h-4 w-4" />
                Card frozen successfully
              </div>
            )}
            {freezeError && (
              <div className="text-red-700 bg-red-50 border border-red-200 rounded p-2 text-xs">
                {freezeError}
              </div>
            )}
            <Button
              onClick={handleFreeze}
              variant="destructive"
              size="sm"
              disabled={freezing || (currentRole === "agent" && !otp)}
              className="w-full">
              {freezing ? "Freezing..." : "Freeze Card"}
            </Button>
          </CardContent>
        </Card>

        {/* Open Dispute Action */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base">Open Dispute</CardTitle>
            </div>
            <CardDescription className="text-xs">
              File a dispute for unauthorized or fraudulent transaction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start space-x-2 rounded-md border p-3">
              <Checkbox
                id="confirm-dispute"
                checked={confirm}
                onCheckedChange={(checked: boolean) =>
                  setConfirm(checked === true)
                }
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="confirm-dispute"
                  className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I confirm this action
                </label>
                <p className="text-xs text-muted-foreground">
                  This will initiate a formal dispute process (Reason: 10.4 -
                  Fraud)
                </p>
              </div>
            </div>
            {disputeSuccess && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded p-2 text-xs">
                <CheckCircle className="h-4 w-4" />
                Dispute opened successfully
              </div>
            )}
            {disputeError && (
              <div className="text-red-700 bg-red-50 border border-red-200 rounded p-2 text-xs">
                {disputeError}
              </div>
            )}
            <Button
              onClick={handleDispute}
              variant="default"
              size="sm"
              disabled={disputing || !confirm}
              className="w-full">
              {disputing ? "Processing..." : "Open Dispute"}
            </Button>
          </CardContent>
        </Card>

        {/* Warning Notice */}
        <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs">
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
          <p className="text-yellow-800">
            <strong>Note:</strong> These actions affect the customer's account.
            Ensure you have verified the customer's identity before proceeding.
          </p>
        </div>
      </div>
    </div>
  )
}
