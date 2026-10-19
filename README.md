# BookkeepGenie

**AI financial operations partner for owner-managed South African businesses.**

BookkeepGenie ingests bank activity, classifies and reconciles it automatically, surfaces exceptions for the owner to resolve, and hands the accountant a close-ready set of books — without letting an AI mistake quietly corrupt the ledger.

The goal is not to automate accounting. It is to reduce the owner's involvement to only the decisions a machine should not make.

---

## Why I built this

Accounting is going AI-first. Tools like Digits, Kick, and Stub are racing toward self-driving books — categorise, reconcile, and report with minimal human touch. The vision is right.

The hard part isn't extraction — modern models read a receipt fine. The hard part is **trust**: an LLM will happily book an owner's capital injection as revenue, overstating profit and triggering VAT that shouldn't exist. In accounting, a confident wrong answer is worse than no answer.

So I built BookkeepGenie to pressure-test the unglamorous half of that vision: *how do you let a probabilistic model drive the books without ever letting it corrupt them?*

The answer is defence-in-depth: the AI proposes, but deterministic guardrails dispose. A wrong AI guess is structurally prevented from reaching the ledger.

Built to demonstrate:

- Constraining a probabilistic classifier with deterministic guardrails
- Domain-correct SA financial logic (VAT, owner funds, multi-tenancy)
- Vision + language extraction from messy real-world inputs
- AI autonomy proportional to financial risk
- Eval- and test-gated delivery

---

## The product thesis

The headline metric is **Owner Touch Rate**: what percentage of financial events require the business owner to do anything?

Today that number is effectively 100%. BookkeepGenie's job is to drive it down — without increasing accounting risk.

```
Today        →  100%
Early BKG    →   40%
Mature BKG   →   15%
Target       →   <5%
```

The Exception Inbox exists for the remaining 5%. Everything else happens silently.

The owner should open BookkeepGenie and see:

```
You're 94% done for October
3 things need you

R4,280 — Builders Warehouse
We think this is Equipment.
Receipt found ✓  |  VAT detected ✓
[ Confirm ]

R25,000 — Transfer from Andrew
This looks like owner funding.
[ Capital ]  [ Director loan ]  [ Something else ]

R12,500 — Payment received
Likely matches Invoice #1043 from Acme.
[ Match ]
```

Not: "Here's your chart of accounts. Please categorise 76 transactions."

---

## The core idea: 5-layer owner-funds enforcement

The AI classifies each transaction, but no single layer is trusted to be right. Five independent layers each guard the books, so failure of any one cannot corrupt them:

1. **Rules-first classifier** — deterministic regex catches the common owner-funds cases (~80% of traffic) at zero API cost.
2. **LLM fallback** — anything unmatched goes to the model with a strict schema and a low-confidence floor.
3. **User confirmation modal** — when owner funds are suspected, the transaction is not saved until the user explicitly confirms Capital / Director's Loan / Override.
4. **Server-side enforcement** — `enforceOwnerFundsRules()` sets `direction`, `affectsProfit`, and `taxCode` from `kind`, regardless of what the client sent.
5. **PostgreSQL CHECK constraints** — the database rejects any row that violates owner-funds invariants, even via direct SQL. Last line of defence.

Capital and director's loans are structurally excluded from the P&L and VAT. No single layer failing can change that.

---

## AI autonomy tiers

The owner-funds enforcement is an instance of a broader platform principle: **AI autonomy proportional to financial risk.**

| Tier | Examples | Behaviour |
|---|---|---|
| **Low risk — autonomous** | Extract receipt, suggest merchant, attach document, identify likely invoice, detect duplicate | AI acts silently |
| **Medium risk — act + reversible** | Categorise normal expense, reconcile high-confidence invoice payment, assign VAT code for known supplier | AI acts; surfaces in activity log with undo |
| **High risk — explicit approval** | Owner funds, unusual VAT treatment, journal entries, write-offs, large corrections, locked period | Confirmation required |

Key eval metric: **precision over recall**. A wrong autonomous match silently corrupting the ledger destroys trust. Creating an exception is always safer than a wrong silent decision. Target: autonomous reconciliation precision ≥99%.

---

## Where this is going

The current product proves the classification and owner-funds layer. The next experiment is: *can BookkeepGenie ingest a real bank statement and autonomously turn most of it into correctly reconciled books?*

The next build gate, before anything else:

| | Item |
|---|---|
| ✅ | Core ledger, AI extraction, owner-funds, VAT/IRP6, reports, multi-tenancy |
| 🔲 | Bank statement CSV import + normalisation + duplicate detection |
| 🔲 | AI matching: bank transaction ↔ existing transaction/receipt |
| 🔲 | AI classification for unmatched bank transactions |
| 🔲 | Exception Inbox |
| 🔲 | Autonomy tiers enforced across all transaction types |
| 🔲 | Period completeness / Ready-to-Close calculation |
| 🔲 | Accountant handoff export |

The core loop to prove: **bank activity in → BKG handles most of it → owner resolves exceptions → clean period out.**

Invoicing, payment agents, direct bank feeds, and financial memory follow only after that loop is validated on real businesses.

---

## Capabilities (current)

- AI receipt extraction (images + PDFs) via OpenAI vision
- Natural-language transaction entry ("Paid R1,500 to the plumber on the 3rd")
- Voice entry — record a note, transcribed via Transcript Insights (Whisper → Claude) into the same NL pipeline
- Five financial reports — P&L, Balance Sheet, Cash Flow, Trial Balance, Management Accounts — with custom date ranges
- VAT201 and IRP6 calculations with correct exclusion rules built in
- Multi-tenant data model (one user → many organisations); every query scoped by `userId + organisationId`, data never crossing org boundaries

---

## Architecture

```
React + Vite (client)  ──HTTP/JSON──>  Express + TypeScript (server)
        │                                     │
        │ voice note                ┌─────────┴─────────┐
        ▼                           ▼                   ▼
 Transcript Insights        PostgreSQL (Neon)      OpenAI API
 /transcribe (Whisper)      via Drizzle ORM        (vision + text)
```

Auth: Clerk (`@clerk/clerk-react` + `@clerk/express`). Storage: PostgreSQL (10 tables); migrations in `migrations/`. File uploads: Multer (memory for AI processing, disk for archival). Voice: the browser calls the Transcript Insights `/transcribe` endpoint directly; everything else runs through this app's own server and OpenAI.

---

## Tests

The owner-funds guarantees are enforced by an automated suite that gates every deploy:

```bash
npm run test:agent        # 40 core tests, ~10–15s
npm run test:agent:fuzz   # property-based fuzz (Balance Sheet: A = L + E), ~30s
npm run test:agent:all    # both
```

Coverage includes owner-funds exclusion from P&L/VAT, cross-organisation isolation, a seeded golden month with exact figures, classifier phrase coverage, and a property-based fuzz check that Assets = Liabilities + Equity always holds. Test failure blocks the build.

Upcoming test additions (tracking the build gate above): bank import parsing, duplicate detection, reconciliation matching golden dataset, false-match tests, confidence-threshold tests, autonomy-tier enforcement, undo/reversal integrity, exception lifecycle, Ready-to-Close completeness, locked-period mutation, audit-log integrity, and cross-organisation bank/reconciliation isolation.

---

## Run locally

```bash
npm install
npm run db:push          # sync schema
npm run dev              # starts Express + Vite on :5000
```

Required env vars: `DATABASE_URL`, `OPENAI_API_KEY`, `SESSION_SECRET`, `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`. Voice entry additionally uses `VITE_TI_API_URL` and `VITE_TI_CLIENT_API_KEY`.

---

## Further reading

- [`BookkeepGenie_PRODUCT.md`](./BookkeepGenie_PRODUCT.md) — what it does and the business logic
- [`BookkeepGenie_SYSTEM.md`](./BookkeepGenie_SYSTEM.md) — how it works internally
- [`server/tests/agent/SPEC.md`](./server/tests/agent/SPEC.md) — locked-in accounting decisions

---

Built as proof of work by **Andrew Locke** — Technical PM and founder of [Sabrulo](https://sabrulo.com), an independent AI product & strategy practice.
