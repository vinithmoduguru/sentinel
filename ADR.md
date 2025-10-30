# Architecture Decision Records (ADR)

This document captures key architectural decisions made during the development of the Sentinel Support system.

---

## 1. Keyset Pagination over Offset-based Pagination

**Decision**: Use keyset (cursor-based) pagination for transaction listings instead of offset-based pagination.

**Rationale**:
- Stable cursors: Results remain consistent even when new transactions are inserted during pagination
- Performance: O(1) complexity for fetching pages vs O(n) for offset
- Scalability: Works efficiently with millions of rows without degradation
- Database-friendly: Uses indexed columns (`customer_id, ts DESC`) for efficient seeks

**Trade-offs**:
- Cannot jump to arbitrary pages (page 5, page 10)
- Slightly more complex implementation than simple `LIMIT/OFFSET`
- Cursors must be opaque and encoded to prevent manipulation

**Implementation**: `utils/pagination.ts` with Base64URL-encoded JSON cursors containing `{ts, id}` tuples.

---

## 2. Server-Sent Events (SSE) over WebSockets

**Decision**: Use SSE for streaming triage updates to the frontend.

**Rationale**:
- Simpler protocol: Built on HTTP, no special handshake required
- Auto-reconnection: Browsers automatically reconnect on connection drop
- HTTP/2 multiplexing: Multiple SSE streams share a single connection
- No CORS preflight: Regular GET request, easier to secure
- Sufficient for use case: Unidirectional server-to-client is all we need

**Trade-offs**:
- Unidirectional only: Cannot send messages from client after connection established
- Not suitable for bidirectional chat (not needed for our use case)

**Implementation**: `routes/triage.routes.ts` with `Content-Type: text/event-stream` and client reconnection logic in frontend.

---

## 3. Prisma ORM over Raw SQL

**Decision**: Use Prisma as the primary database abstraction layer.

**Rationale**:
- Type safety: Generated TypeScript types ensure compile-time correctness
- Migration management: Version-controlled schema migrations with rollback support
- Multi-database support: Easy to switch between PostgreSQL, MySQL, SQLite
- Developer experience: Intuitive query API reduces boilerplate
- Connection pooling: Built-in connection management

**Trade-offs**:
- Performance overhead: ~5-10% slower than hand-optimized raw SQL
- Limited for complex queries: Some advanced queries require `prisma.$queryRaw`
- Bundle size: Generated client adds to build size

**Mitigation**: Use raw SQL for performance-critical queries (e.g., full-text search on KB).

---

## 4. Redis for Rate Limiting and Idempotency

**Decision**: Use Redis for distributed rate limiting and idempotency key storage.

**Rationale**:
- Atomic operations: `INCR` and `TTL` commands are atomic and thread-safe
- Shared state: Works across multiple API instances (horizontal scaling)
- Performance: Sub-millisecond latency for key lookups
- Expiration: Built-in TTL for automatic cleanup of old idempotency keys

**Trade-offs**:
- External dependency: Requires Redis to be running
- Network hop: Adds ~1-2ms latency per request
- Persistence: Data lost if Redis crashes (acceptable for our use case)

**Fallback**: In-memory token bucket if Redis is unavailable (graceful degradation).

---

## 5. Multi-Agent Orchestration Pattern

**Decision**: Decompose triage logic into specialized agents (Insights, Fraud, KB, Compliance, Summarizer) coordinated by a Planner.

**Rationale**:
- Separation of concerns: Each agent has single responsibility
- Testability: Agents can be unit tested in isolation
- Extensibility: Easy to add new agents without modifying existing ones
- Circuit breakers: Failed agents don't crash the entire pipeline
- Observability: Per-agent metrics and traces for debugging

**Trade-offs**:
- Added latency: Serial execution of agents vs monolithic function
- Complexity: More files and abstractions than a single function

**Mitigation**: 
- 1-second timeout per agent
- 5-second total flow budget
- Parallel agent execution for independent steps (future optimization)

---

## 6. Schema Validation with Zod

**Decision**: Validate all agent inputs/outputs using Zod schemas at runtime.

**Rationale**:
- Catch errors early: Malformed agent outputs detected before persisting to DB
- Documentation: Schemas serve as executable documentation
- Type inference: Zod schemas generate TypeScript types automatically
- Composability: Schemas can be extended and combined

**Trade-offs**:
- Performance overhead: ~5-10ms per validation
- Not enforced at compile time: Requires runtime checks

**Mitigation**: Validation failures annotate traces but don't fail the agent (graceful degradation).

---

## 7. Composite Unique Constraint for Transaction Deduplication

**Decision**: Use `(customer_id, txn_id)` composite unique constraint instead of single-field `id`.

**Rationale**:
- Correct deduplication: External transaction IDs may collide across customers
- Idempotent ingestion: Re-ingesting same transaction is safe (upsert)
- Data integrity: Prevents duplicate charges from appearing in UI

**Trade-offs**:
- Nullable `txn_id`: Must handle legacy transactions without `txn_id`
- Index size: Composite index is larger than single-field index

**Implementation**: Prisma `@@unique([customer_id, txn_id])` with fallback to `id` for null `txn_id`.

---

## 8. Content Security Policy (CSP) Headers

**Decision**: Enforce strict CSP headers on all API responses.

**Rationale**:
- XSS prevention: Blocks inline scripts and unauthorized external resources
- Defense in depth: Even if XSS exists, CSP mitigates impact
- Compliance: Required for handling sensitive financial data

**Policy**: `default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'`

**Trade-offs**:
- Breaks inline styles: Must use external stylesheets or style tags with nonces
- Development friction: Slightly harder to debug when policies are too strict

**Note**: Frontend runs on separate domain, so CSP applies to API only.

---

## 9. Structured JSON Logging with Pino

**Decision**: Use Pino for structured logging instead of console.log or Winston.

**Rationale**:
- Performance: Pino is 5x faster than Winston (async logging)
- Structured: JSON format makes logs searchable in log aggregators (Datadog, Splunk)
- Context: Automatic inclusion of `requestId`, `runId`, `customerId_masked`
- Pretty printing: `pino-pretty` for human-readable dev logs

**Required fields**: `ts`, `level`, `requestId`, `runId`, `sessionId`, `customerId_masked`, `event`, `masked`

**Trade-offs**:
- JSON is harder to read in terminal (mitigated by pino-pretty in dev)
- Requires log shipper in production (e.g., Fluentd)

---

## 10. Flow Budget Enforcement (5-second timeout)

**Decision**: Enforce a 5-second total budget for triage runs, aborting remaining agents if exceeded.

**Rationale**:
- User experience: Agents expect results in <5s
- Resource protection: Prevents runaway agents from consuming resources
- Predictable latency: Worst-case latency is bounded

**Implementation**: Track elapsed time in `planner.ts`, break loop if budget exceeded.

**Trade-offs**:
- Incomplete results: Agents may not run if prior agents are slow
- Requires tuning: Balance between completeness and responsiveness

---

## 11. Virtualized Tables with @tanstack/react-virtual

**Decision**: Use virtualized tables for alerts queue and customer transactions (2k+ rows).

**Rationale**:
- Performance: Only renders visible rows, keeps DOM small
- Smooth scrolling: No jank even with large datasets
- Memory efficient: Doesn't load entire dataset into memory

**Trade-offs**:
- Complexity: More complex than simple `map()` over array
- Fixed row heights: Requires estimating row height upfront

**Implementation**: `Alerts.tsx` and `Customer.tsx` use `useVirtualizer` with 72px estimated row height.

---

## 12. RBAC (Role-Based Access Control) with API Keys

**Decision**: Implement two roles (`agent`, `lead`) with different permissions.

**Rationale**:
- Security: Not all actions should be available to all users
- Audit trail: Know who performed which action
- Policy enforcement: `lead` can bypass OTP requirement for freezing cards

**Trade-offs**:
- Simple model: Only two roles (could extend to more granular permissions)
- Static API keys: In production, use OAuth2/JWT with dynamic tokens

**Implementation**: `middleware/apiKey.ts` with `requireRole(role)` middleware.

---

## Summary

These decisions prioritize **developer experience**, **performance**, and **security** while maintaining **simplicity** where possible. Trade-offs were evaluated based on the constraint of delivering a production-ready system in a tight timeline (2 hours).

