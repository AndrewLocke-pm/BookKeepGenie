# AI Bookkeeper

AI-powered bookkeeping for South African small businesses. Upload a receipt or describe a transaction in plain English; the app extracts, classifies, and files it correctly for VAT201 and IRP6.

## Capabilities

- AI receipt extraction (images + PDFs) via OpenAI vision
- Natural-language transaction entry
- Five financial reports (P&L, Balance Sheet, Cash Flow, Trial Balance, Management Accounts) with custom date ranges
- Bulletproof owner-funds classification (5 enforcement layers)
- VAT201 and IRP6 calculations
- Multi-tenant data model (one user → one or more organisations); all queries scoped by `userId + organisationId`
- "Financial Hub" UI redesign previews at `/ui-preview/dashboard` and `/ui-preview/add-transaction` (live pages unchanged)

## Architecture

```
React + Vite (client)  ──HTTP/JSON──>  Express + TypeScript (server)
                                              │
                                  ┌───────────┴───────────┐
                                  ▼                       ▼
                          PostgreSQL (Neon)         OpenAI API
                          via Drizzle ORM           (vision + text)
```

Auth: Clerk (`@clerk/clerk-react` + `@clerk/express`).
Storage: PostgreSQL (10 tables); migrations in `migrations/`.
File uploads: Multer (memory for AI processing, disk for archival).

## Run Locally

```bash
npm install
npm run db:push          # sync schema
npm run dev              # starts Express + Vite on :5000
```

Required env vars: `DATABASE_URL`, `OPENAI_API_KEY`, `SESSION_SECRET`, `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.

## Tests

```bash
npm run test:agent        # 40 core tests, ~10–15s
npm run test:agent:fuzz   # property-based fuzz, ~30s
npm run test:agent:all    # both
```

Tests run against the real database scoped to a hard-coded `test-user-001`. They block deployment if they fail.

## Further Reading

- [`BookkeepGenie_PRODUCT.md`](./BookkeepGenie_PRODUCT.md) — what it does and the business logic
- [`BookkeepGenie_SYSTEM.md`](./BookkeepGenie_SYSTEM.md) — how it works internally
- [`server/tests/agent/SPEC.md`](./server/tests/agent/SPEC.md) — locked-in accounting decisions
