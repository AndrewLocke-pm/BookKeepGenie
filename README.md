# BookkeepGenie

AI-powered bookkeeping for South African small businesses. Snap a receipt or describe a transaction in plain English; BookkeepGenie extracts it, classifies it, and files it correctly for **VAT201** and **IRP6** — without letting owner funds quietly corrupt the books.

---

## Why I built this

South African sole traders and owner-managed companies lose accuracy in two places: capital contributions and director's loans accidentally land on the P&L (overstating profit), and VAT gets charged on transactions that should be out-of-scope. Both are easy for software to get wrong and expensive to get wrong.

So the interesting problem here wasn't the AI extraction — it was **trusting** it. An LLM will happily misclassify an owner's capital injection as revenue. The build is really an exercise in *constraining* a probabilistic model with deterministic guardrails, so a wrong AI guess can never actually corrupt the ledger.

Built to demonstrate:

- Vision + language extraction from messy real-world inputs (receipts, plain English)
- Defense-in-depth around a probabilistic classifier
- Domain-correct financial logic (VAT, owner funds, multi-tenancy)
- Eval- and test-gated delivery

---

## The core idea: 5-layer owner-funds enforcement

The AI classifies a transaction, but **no single layer is trusted to be right.** Five independent layers each guard the books, so failure of any one cannot corrupt them:

1. **Rules-first classifier** — deterministic regex catches the common owner-funds cases (~80% of traffic) at zero API cost.
2. **LLM fallback** — anything unmatched goes to the model with a strict schema and a low-confidence floor.
3. **User confirmation modal** — when owner funds are suspected, the transaction is *not saved* until the user explicitly confirms Capital / Director's Loan / Override.
4. **Server-side enforcement** — `enforceOwnerFundsRules()` sets `direction`, `affectsProfit`, and `taxCode` from `kind`, regardless of what the client sent.
5. **PostgreSQL CHECK constraints** — the database rejects any row that violates owner-funds invariants, even via direct SQL. Last line of defence.

The result: capital and director's loans are structurally excluded from the P&L and VAT, and no layer failing alone can change that.

---

## Capabilities

- AI receipt extraction (images + PDFs) via OpenAI vision
- Natural-language transaction entry ("Paid R1,500 to the plumber on the 3rd")
- Five financial reports — P&L, Balance Sheet, Cash Flow, Trial Balance, Management Accounts — with custom date ranges
- VAT201 and IRP6 calculations with correct exclusion rules built in
- Multi-tenant data model (one user → many organisations); every query scoped by `userId + organisationId`, data never crossing org boundaries

---

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

---

## Tests

The owner-funds guarantees are enforced by an automated suite that gates every deploy:

```bash
npm run test:agent        # 40 core tests, ~10–15s
npm run test:agent:fuzz   # property-based fuzz (Balance Sheet: A = L + E), ~30s
npm run test:agent:all    # both
```

Coverage includes owner-funds exclusion from P&L/VAT, cross-organisation isolation, a seeded golden month with exact figures, classifier phrase coverage, and a property-based fuzz check that `Assets = Liabilities + Equity` always holds. Test failure blocks the build.

---

## Run Locally

```bash
npm install
npm run db:push          # sync schema
npm run dev              # starts Express + Vite on :5000
```

Required env vars: `DATABASE_URL`, `OPENAI_API_KEY`, `SESSION_SECRET`, `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.

---

## Further reading

- [`BookkeepGenie_PRODUCT.md`](./BookkeepGenie_PRODUCT.md) — what it does and the business logic
- [`BookkeepGenie_SYSTEM.md`](./BookkeepGenie_SYSTEM.md) — how it works internally
- [`server/tests/agent/SPEC.md`](./server/tests/agent/SPEC.md) — locked-in accounting decisions

---

Built as proof of work by [Andrew Locke](https://www.linkedin.com/in/andrew-b-locke/) — Technical PM and founder of [Sabrulo](https://www.sabrulo.com/), an independent AI product & strategy practice.
