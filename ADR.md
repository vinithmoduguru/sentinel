# Architecture Decisions (8–12 bullets)

- Keyset pagination for transactions using `(customer_id, ts DESC)` index and cursor `{ts,id}` to meet the 90d p95 ≤100ms target. Implemented in `backend/src/utils/pagination.ts` and enforced via Prisma `@@index([customer_id, ts(sort: Desc)])`.
- SSE for triage streaming (unidirectional) to keep the protocol simple and resilient; implemented in `backend/src/routes/triage.routes.ts` with `text/event-stream` and client reconnects.
- Prisma as ORM for type‑safe models and migrations; we fall back to raw SQL where needed. Schema lives in `backend/prisma/schema.prisma`; migrations under `backend/prisma/migrations`.
- Composite unique `(customer_id, txn_id)` for ingest dedupe/idempotency; supports legacy null `txn_id`. See `Transaction` model and migration `20251030_add_txn_id`.
- Redis‑backed token bucket rate limiter with Retry‑After; fail‑open if Redis is down. See `backend/src/middleware/rateLimiter.ts` and `backend/src/utils/redis.ts`.
- Idempotency middleware caches successful JSON responses keyed by `Idempotency-Key` per scope (actions/ingest). See `backend/src/middleware/idempotency.ts`.
- Multi‑agent orchestration via planner/executor with per‑tool timeouts (~1s) and overall flow budget (≤5s); traces recorded per step. See `backend/src/orchestrator/*` and `backend/src/services/triageService.ts`.
- Zod schemas validate agent I/O at runtime; failures annotate traces without crashing the run. See `backend/src/utils/schemaValidator.ts` and `backend/src/schemas/*`.
- Strict CSP and security headers applied at the API to reduce XSS risk on sensitive pages. See `backend/src/middleware/csp.ts`.
- Structured JSON logging with Pino including `requestId`, `runId`, and `customerId_masked`; pretty output in dev. See `backend/src/utils/logger.ts`.
- PII redaction masks PAN‑like 13–19 digits and emails in logs/traces/UI. See `backend/src/utils/redactor.ts`.
- Prometheus metrics for API/agent latency, rate‑limit blocks, fallbacks, and policy blocks exposed at `/metrics`. See `backend/src/utils/metrics.ts`.

