# AI Bookkeeper

AI-powered bookkeeping for South African small business tax compliance (VAT201, IRP6).

## User Preferences

Preferred communication style: simple, everyday language.

## Documentation

This project's documentation lives in three files. Read them before making changes:

- [`BookkeepGenie_README.md`](./BookkeepGenie_README.md) — entry point, capabilities, dev setup
- [`BookkeepGenie_PRODUCT.md`](./BookkeepGenie_PRODUCT.md) — product, user flows, business/financial logic
- [`BookkeepGenie_SYSTEM.md`](./BookkeepGenie_SYSTEM.md) — architecture, AI pipeline, data model, enforcement layers, file map

Locked-in accounting decisions: [`server/tests/agent/SPEC.md`](./server/tests/agent/SPEC.md).

## Important Constraints

- Auth is **Clerk** (`@clerk/clerk-react` + `@clerk/express`). Do not reintroduce Replit OIDC.
- Database is PostgreSQL (Neon serverless) via Drizzle ORM; 10 tables; multi-tenancy foundation in place.
- Owner funds (`kind ∈ {capital, owner_loan, transfer, tax}`) are excluded from P&L and VAT — enforced in five independent layers.
- Tests run against the real DB scoped to `test-user-001`; `npm run test:agent` is a pre-deploy gate.
- `package.json`, `vite.config.ts`, `server/vite.ts`, and `drizzle.config.ts` are off-limits to direct edits.

## Current Work

- "Financial Hub" UI redesign is in the **preview phase**: `/ui-preview/dashboard` and `/ui-preview/add-transaction` (Clerk-authenticated, real data, org-scoped). Shared components in `client/src/components/bookkeeper/`. Production pages are untouched; next phase swaps the approved designs into the real pages. See BookkeepGenie_SYSTEM.md → "UI Redesign Previews".
