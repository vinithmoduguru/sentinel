# Backend (minimal)

This folder contains a minimal TypeScript + Express backend intended for local
development and as a starting point.

Quick start

1. Copy environment file:

```bash
cp .env.example .env
# Edit .env and set DATABASE_URL, PORT as needed
```

2. Install deps (run from repository root or inside `backend`):

```bash
cd backend
npm install
```

3. Generate Prisma client (if using Prisma):

```bash
npm run prisma:generate
```

4. Start in development (auto-reloads via `tsx` watch):

```bash
npm run dev
```

5. Build and run production:

```bash
npm run build
npm start
```

Useful scripts

- `npm run dev` — run code with TS runtime and watch for changes
- `npm run build` — transpile TypeScript to `dist/`
- `npm start` — run compiled `dist/server.js`
- `npm run prisma:generate` — generate Prisma client
- `npm run prisma:migrate` — run Prisma migrations (development)

## API: Alerts Queue

GET `/api/alerts?limit=&cursor=&status=&risk=`

Response shape:

```json
{
  "items": [
    {
      "id": 1,
      "createdAt": "2025-10-29T18:20:10.000Z",
      "risk": "HIGH",
      "status": "OPEN",
      "customer": { "id": 42, "name": "Jane D" },
      "transaction": {
        "id": 987,
        "merchant": "ABC Mart",
        "mcc": "5411",
        "amountCents": 499900,
        "currency": "INR",
        "ts": "2025-10-28T12:00:00.000Z"
      },
      "canOpenTriage": true
    }
  ],
  "nextCursor": "opaque"
}
```
