# Sentinel Support

Full‑stack console to ingest/explore transactions, stream triage, and execute safe actions with guardrails.

## Run (≤3 commands)

```bash
docker compose up                     # pg + redis + seed + api + web
open http://localhost:5173            # UI (API http://localhost:4000, metrics /metrics)
```

**Note:** A dedicated `seed` service runs automatically before the API starts:
- 10,000 customers with cards and accounts
- 200,000 transactions (configurable via `TXN_COUNT` env var in `docker-compose.yml`)
- 500 alerts with triage runs and agent traces
- 200 cases with case events
- KB docs and policy documents
- **Deterministic eval fixtures** with real database IDs in `/fixtures/evals/`

**View seed logs:**
```bash
docker compose logs seed              # View seed output
docker compose logs -f seed           # Follow seed logs in real-time
```

**Re-run seed only:**
```bash
docker compose up seed --force-recreate
```

### Seed Configuration

Control seed data volume via environment variables in the `seed` service in `docker-compose.yml`:

```yaml
seed:
  environment:
    TXN_COUNT: "200000"    # Total transactions to generate (default: 1M)
    BATCH_SIZE: "10000"    # Batch size for bulk inserts (default: 5k)
```

Or run seed manually with custom values:

```bash
# Fast seed (200k transactions)
cd backend && npm run seed:fast

# Full 1M transactions
npm run seed:1m

# Custom count
TXN_COUNT=500000 BATCH_SIZE=10000 npm run seed
```

## Architecture

```
+---------------------+       HTTP + SSE        +-----------------------------+
|   React (Vite)      | <---------------------> |   Express API (TypeScript)  |
| /dashboard /alerts  |                         | - Orchestrator (planner/exe)|
| /customer /evals    |                         |   agents: insights,risk,kb   |
| Triage Drawer (SSE) |                         |   compliance,summarizer      |
+---------------------+                         | - Middleware: rate,idem,auth |
                                              |   apiKey(agent/lead), csp     |
                                              | - Metrics (/metrics), logs     |
                                              +---------------+---------------+
                                                              |
                                                              v
                                   +----------------+       +------------------+
                                   | Postgres       |       | Redis            |
                                   | Prisma models  |       | rate-limit,idem. |
                                   +----------------+       +------------------+
                                                              ^
                                                              |
                                    +-------------------------+------------------+
                                    |                 Seed Service                |
                                    | customers/cards/txns/alerts/cases/kb        |
                                    | deterministic evals -> /fixtures/evals      |
                                    +---------------------------------------------+
```

## Key trade-offs

- Keyset pagination over offset: stable cursors on `(customer_id, ts)`, fast seeks.
- SSE for triage streaming: simple HTTP and auto‑reconnect; one‑way is enough.
- Prisma ORM: type‑safe and migrations; raw SQL used where needed.
- Redis for rate‑limit + idempotency: atomic, shared; fail‑open on outage.
- Multi‑agent pipeline: bounded timeouts (≈1s/tool, ≤5s flow); clearer responsibilities.
- Zod validation: runtime schemas for agent I/O; small overhead acceptable.

## Eval Fixtures & Testing

The seed script automatically generates **deterministic eval fixtures** that match the seeded data:

### Generated Fixtures

All fixtures are written to `/fixtures/evals/` with actual database IDs:

- `freeze_otp.json` - OTP flow validation (pending → success)
- `dispute.json` - Dispute creation with KB citations
- `duplicate_auth_vs_capture.json` - Preauth vs capture scenarios
- `ambiguous_merchants.json` - Merchant disambiguation via Insights API
- `device_change.json` - New device detection in triage
- `fallback_path.json` - Circuit breaker fallback behavior
- `risk_timeout_fallback.json` - Risk tool timeout handling
- `travel_window.json` - Foreign country transaction detection
- `pii_redaction.json` - PAN redaction in traces
- `rate_limit.json` - 429 rate limiting behavior
- `performance_90d.json` - 90-day query performance benchmarks
- `readme.json` - Documentation of eval categories
- `_eval_reference.json` - Reference file with all eval entity IDs

### Running Evals

```bash
cd backend && npm run eval
```

**Output includes:**
- Task success rate, fallback rate by tool
- Agent latency p50/p95
- Risk confusion matrix (LOW|MEDIUM|HIGH)
- Top policy denials

### Why Auto-Generated?

✅ **IDs match database** - No hardcoded IDs that break on fresh setups  
✅ **Works anywhere** - Anyone can run `docker-compose up` and evals pass  
✅ **Always fresh** - Regenerated on each seed to match current data  
✅ **Deterministic scenarios** - Specific merchants (ABC Mart, QuickCab) for reliable testing

**Note:** Eval fixtures are **overwritten** on each seed run. Custom test cases should use different filenames (e.g., `custom_*.json`).

## Performance (90d keyset on 1M rows)

```sql
EXPLAIN ANALYZE
SELECT id, ts, amount_cents
FROM transactions
WHERE customer_id = $1 AND ts >= NOW() - INTERVAL '90 days'
ORDER BY ts DESC, id DESC
LIMIT 50;
-- Index Scan on (customer_id, ts DESC); planning ~0.2ms, execution ~45ms (target p95 ≤100ms)
```

## Postman Collection

- File: `postman_collections.json` (repo root)
- Import into Postman and set variables:
  - `api_key` (default `agent_secret_123`), `idem_key` (use `{{$guid}}`), `customer_id`, `alert_id`, `card_id`, `txn_id`.

## Eval Report

- File: `EVAL_REPORT.md`
- To regenerate locally:
  - `cd backend && npm ci && npm run eval`
- Report includes: totals, pass rate, p50/p95 latency, fallback rate, risk confusion matrix, top policy denials.

