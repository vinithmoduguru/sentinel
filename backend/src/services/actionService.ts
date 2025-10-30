import prisma from "../config/database.js"
import { incrementMetric } from "../utils/metrics.js"
import { redactor } from "../utils/redactor.js"

type FreezeCardInput = { cardId: number; otp?: string }
type OpenDisputeInput = { txnId: number; reasonCode: string; confirm: boolean }

type Role = "agent" | "lead"
type ActionContext = { requestId?: string; role?: Role }

export async function logCaseEvent(
  tx: any,
  caseId: number,
  actor: string,
  action: string,
  payload: any
) {
  const redacted = redactor(payload)
  await tx.caseEvent.create({
    data: {
      case_id: caseId,
      actor,
      action,
      payload_json: redacted,
    },
  })
}

export async function handleFreezeCard(
  input: FreezeCardInput,
  ctx: ActionContext
) {
  const { cardId, otp } = input
  const { requestId, role } = ctx
  const actor = role ?? "SYSTEM"

  if (!otp && role !== "lead") {
    incrementMetric("action_blocked_total", { policy: "otp_required" })
    const pending = { status: "PENDING_OTP", requestId: requestId || null }
    return pending
  }

  if (otp && otp !== "123456") {
    return { status: "INVALID_OTP", requestId: requestId || null }
  }

  const card = await prisma.card.findUnique({ where: { id: cardId } })
  if (!card) {
    return { status: "NOT_FOUND", requestId: requestId || null }
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.card.update({
      where: { id: cardId },
      data: { status: "FROZEN" },
    })

    // Create a case to attach audit event
    const caseRecord = await tx.case.create({
      data: {
        customer_id: updated.customer_id,
        type: "CARD_FREEZE",
        status: "COMPLETED",
      },
    })

    await logCaseEvent(tx, caseRecord.id, actor, "CARD_FROZEN", {
          cardId: updated.id,
          previousStatus: card.status,
          newStatus: updated.status,
    })

    return { status: "FROZEN", requestId: requestId || null }
  })

  return result
}

export async function handleOpenDispute(
  input: OpenDisputeInput,
  ctx: ActionContext
) {
  const { txnId, reasonCode, confirm } = input
  const { requestId, role } = ctx
  const actor = role ?? "SYSTEM"

  if (!confirm && role !== "lead") {
    // Soft-block until confirm is true
    incrementMetric("action_blocked_total", { policy: "confirmation_required" })
    const resp = {
      status: "CONFIRMATION_REQUIRED",
      requestId: requestId || null,
    }
    return resp
  }

  const txn = await prisma.transaction.findUnique({ where: { id: txnId } })
  if (!txn) return { status: "NOT_FOUND", requestId: requestId || null }

  const result = await prisma.$transaction(async (tx) => {
    const caseRecord = await tx.case.create({
      data: {
        customer_id: txn.customer_id,
        txn_id: txn.id,
        type: "DISPUTE",
        status: "OPEN",
        reason_code: reasonCode,
      },
    })

    // Try to find a policy related to disputes
    const policy = await tx.policy.findFirst({
      where: { title: { contains: "Dispute", mode: "insensitive" } },
      orderBy: { id: "asc" },
    })

    await logCaseEvent(tx, caseRecord.id, actor, "DISPUTE_OPENED", {
          txnId: txn.id,
          reasonCode,
          kbCitation: policy
            ? { policyId: policy.id, code: policy.code, title: policy.title }
            : null,
    })

    return { caseId: caseRecord.id, status: "OPEN" as const }
  })

  return result
}
