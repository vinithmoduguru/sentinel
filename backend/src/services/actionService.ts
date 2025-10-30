import prisma from "../config/database.js"
import { incrementMetric } from "../utils/metrics.js"

type FreezeCardInput = { cardId: number; otp?: string }
type OpenDisputeInput = { txnId: number; reasonCode: string; confirm: boolean }

type ActionContext = { requestId?: string }

export async function handleFreezeCard(
  input: FreezeCardInput,
  ctx: ActionContext
) {
  const { cardId, otp } = input
  const { requestId } = ctx

  if (!otp) {
    incrementMetric("action_blocked_total", { policy: "otp_required" })
    const pending = { status: "PENDING_OTP", requestId: requestId || null }
    return pending
  }

  if (otp !== "123456") {
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

    await tx.caseEvent.create({
      data: {
        case_id: caseRecord.id,
        actor: "SYSTEM",
        action: "CARD_FROZEN",
        payload_json: {
          cardId: updated.id,
          previousStatus: card.status,
          newStatus: updated.status,
        },
      },
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
  const { requestId } = ctx

  if (!confirm) {
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

    await tx.caseEvent.create({
      data: {
        case_id: caseRecord.id,
        actor: "SYSTEM",
        action: "DISPUTE_OPENED",
        payload_json: {
          txnId: txn.id,
          reasonCode,
          kbCitation: policy
            ? { policyId: policy.id, code: policy.code, title: policy.title }
            : null,
        },
      },
    })

    return { caseId: caseRecord.id, status: "OPEN" as const }
  })

  return result
}
