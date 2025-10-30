# Sentinel Support: Full-Stack Fintech Case Resolution

A production-grade case-resolution console for support agents to investigate customer activity, generate AI insights, and execute safe actions via multi-agent triage with policy guardrails and observability.

## 📚 Documentation

- **[UI Improvements Summary](UI_IMPROVEMENTS.md)** - Complete overview of recent UI polish and bug fixes
- **[RBAC Usage Guide](RBAC_USAGE_GUIDE.md)** - How to use the role selector and perform actions
- **[Architecture Decisions](ADR.md)** - Key technical decisions and trade-offs
- **[Testing Summary](TESTING_SUMMARY.md)** - Test results and acceptance scenarios

## Quick Start (4 Commands)

```bash
# 1. Start all services
docker compose up -d

# 2. Seed database with test data
cd backend && npm run seed:fast

# 3. Select your role in the UI
# Open http://localhost:5173 and click "Agent" or "Lead" in the header

# 4. Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:4000
# Metrics: http://localhost:4000/metrics
```

> ⚠️ **Important**: Before performing any actions, you must select a role (Agent or Lead) in the header. See [RBAC Usage Guide](RBAC_USAGE_GUIDE.md) for details.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend (Vite)                    │
│  /dashboard  /alerts  /customer/:id  /evals                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/SSE
┌────────────────────────────┴────────────────────────────────────┐
│                   Express API (TypeScript)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Multi-Agent Orchestrator (Planner + Executor)           │  │
│  │  ├─ Insights Agent   (spend patterns, anomalies)         │  │
│  │  ├─ Fraud Agent      (velocity, device, MCC rarity)      │  │
│  │  ├─ KB Agent         (policy citations)                  │  │
│  │  ├─ Compliance Agent (OTP/RBAC gates)                    │  │
│  │  └─ Summarizer       (customer message + internal note)  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Middleware: Rate Limit • Idempotency • Auth • CSP      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────┬───────────────────────────┬────────────────────────┘
             │                           │
    ┌────────┴────────┐         ┌────────┴────────┐
    │  PostgreSQL     │         │     Redis       │
    │  (Prisma ORM)   │         │  (rate limit +  │
    │  Transactions   │         │   idempotency)  │
    │  Customers      │         │                 │
    │  Alerts, Cases  │         └─────────────────┘
    └─────────────────┘
```

## Key Features

### Frontend
- **Dashboard**: Real-time KPIs (alerts in queue, disputes opened, avg triage latency)
- **Alerts Queue**: Virtualized table (handles 2k+ rows), risk filtering, pagination
- **Customer Detail**: Transaction timeline, category spend charts, merchant mix, anomalies
- **Triage Drawer**: SSE streaming updates, full keyboard navigation (ESC, Tab, Enter)
- **Evals Page**: Run acceptance tests, view pass/fail rates, confusion matrix

### Backend
- **Multi-Agent Pipeline**: Bounded plan execution with timeouts (1s per tool, 5s flow budget)
- **Rate Limiting**: Token bucket (5 req/s), 429 with Retry-After header
- **Idempotency**: Header-based replay protection (Redis TTL)
- **Security**: CSP headers, API key auth (agent/lead RBAC), PII redaction, input sanitization
- **Observability**: Prometheus metrics (/metrics), structured JSON logs, agent traces
- **Actions**: Freeze card (OTP flow), open dispute, contact customer (email/SMS mock)

## Performance Benchmarks

- **p95 latency**: ≤100ms for `/api/customer/:id/transactions?last=90d` with 1M rows
- **Query optimization**: Keyset pagination, composite indexes on `(customer_id, ts DESC)`
- **Virtualization**: React tables handle 2k+ rows without jank

```sql
-- Explain Analyze example (1M rows)
EXPLAIN ANALYZE 
SELECT * FROM transactions 
WHERE customer_id = 123 AND ts >= NOW() - INTERVAL '90 days'
ORDER BY ts DESC LIMIT 50;

-- Index Scan using idx_customer_ts on transactions (cost=0.42..120.45 rows=50)
-- Planning Time: 0.15ms | Execution Time: 45ms
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingest/transactions` | POST | Ingest transactions (CSV/JSON), dedupe by `(customerId, txnId)` |
| `/api/customer/:id/transactions` | GET | Keyset paginated transactions |
| `/api/insights/:customerId/summary` | GET | Spend categories, trends, anomalies |
| `/api/triage` | POST | Start triage run, returns `runId` |
| `/api/triage/:runId/stream` | GET | SSE stream of triage events |
| `/api/action/freeze-card` | POST | Freeze card (OTP required unless lead) |
| `/api/action/open-dispute` | POST | Create dispute case with KB citation |
| `/api/action/contact-customer` | POST | Mock email/SMS notification |
| `/api/kb/search?q=` | GET | Search knowledge base |
| `/api/alerts` | GET | Paginated alerts queue |
| `/api/dashboard/kpis` | GET | Dashboard metrics |
| `/metrics` | GET | Prometheus metrics |

## Development

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 14+
- Redis 7+

### Local Setup

```bash
# Clone and install
git clone <repo>
cd sentinel

# Start infrastructure
docker compose up -d postgres redis

# Backend setup
cd backend
cp .env.example .env  # Edit DATABASE_URL, REDIS_URL
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed:fast  # 200k transactions

# Start backend
npm run dev  # http://localhost:3000

# Frontend setup (separate terminal)
cd front-end/vite-project
npm install
npm run dev  # http://localhost:5173
```

### Running Evals

```bash
cd backend
npm run eval
```

Output:
```
============================================================
SENTINEL EVAL REPORT
============================================================

📊 Summary:
   Total cases: 12
   ✅ Passed: 11
   ❌ Failed: 1
   Success rate: 91.7%

⏱️  Latency:
   p50: 450ms
   p95: 890ms

🔄 Fallback rate: 8.3%

🎯 Risk Distribution:
   LOW: 3
   MEDIUM: 6
   HIGH: 3
============================================================
```

## Key Trade-offs

### 1. Keyset Pagination over Offset
- **Why**: Stable cursors even with inserts; O(1) page fetch vs O(n) for offset
- **Trade-off**: Cannot jump to arbitrary pages; only next/prev

### 2. SSE over WebSocket
- **Why**: Simpler protocol, auto-reconnect, HTTP/2 multiplexing, no CORS preflight
- **Trade-off**: Unidirectional only; sufficient for streaming triage updates

### 3. Prisma ORM
- **Why**: Type-safe queries, migrations, multi-DB support
- **Trade-off**: Some advanced queries require raw SQL (e.g., full-text search)

### 4. Redis for Rate Limiting
- **Why**: Atomic INCR, TTL, shared state across instances
- **Trade-off**: External dependency; fallback to in-memory if Redis down

### 5. Multi-Agent Orchestration
- **Why**: Separation of concerns, testable agents, circuit breakers
- **Trade-off**: Added latency vs monolithic; mitigated by 1s timeouts

### 6. Schema Validation (Zod)
- **Why**: Runtime validation, catch malformed agent outputs early
- **Trade-off**: Performance overhead (~5-10ms); annotates traces without failing

## Environment Variables

```bash
# Backend (.env)
DATABASE_URL=postgresql://user:pass@localhost:5432/sentinel_db
REDIS_URL=redis://localhost:6379
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
FRONTEND_ORIGIN=http://localhost:5173

# API Keys (for testing)
API_KEY_AGENT=agent_secret_123
API_KEY_LEAD=lead_secret_456
```

## Docker Compose

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f api

# Rebuild
docker compose up --build

# Stop
docker compose down
```

## Project Structure

```
sentinel/
├── backend/           # Node.js + Express API
│   ├── prisma/        # Schema + migrations
│   ├── src/
│   │   ├── agents/    # Insights, Fraud, KB, Compliance, Summarizer
│   │   ├── orchestrator/  # Planner + Executor
│   │   ├── routes/    # Express routes
│   │   ├── services/  # Business logic
│   │   ├── middleware/  # Rate limit, auth, idempotency
│   │   └── utils/     # Logger, metrics, redactor
│   └── fixtures/      # Seed data + evals
├── front-end/vite-project/  # React + TypeScript
│   └── src/
│       ├── pages/     # Dashboard, Alerts, Customer, Evals
│       └── components/  # TriageDrawer, UI components
├── docker-compose.yml
├── ADR.md             # Architecture Decision Records
└── requests.http      # API collection
```

## Testing & Validation

- **Evals**: 12+ golden test cases covering OTP flow, disputes, fallbacks, PII redaction
- **Metrics**: Prometheus counters/histograms for latency, tool calls, fallbacks, rate limits
- **Audit Logs**: All actions append `CaseEvent` with actor, action, redacted payload
- **Security**: PAN-like sequences (13-19 digits) redacted in UI/logs/traces

## License

Proprietary - Internal Use Only

