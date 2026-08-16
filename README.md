# BookkeepGenie

AI-first accounting for South African small businesses. Snap a receipt or describe a transaction in plain English; BookkeepGenie extracts it, classifies it, and files it correctly for **VAT201** and **IRP6** — without letting an AI mistake quietly corrupt the books.

---

## Why I built this

Accounting is going AI-first. Tools like [Digits](https://digits.com/), [Kick](https://www.kick.co/), and [Billow](https://thebillow.ai/) are racing toward "self-driving" books — categorise, reconcile, and report with minimal human touch. The vision is clearly right.

The hard part isn't the extraction — modern models read a receipt fine. The hard part is **trust**: an LLM will happily book an owner's capital injection as revenue, overstating profit and triggering VAT that shouldn't exist. In accounting, a confident wrong answer is worse than no answer.

So I built BookkeepGenie to pressure-test the unglamorous half of the AI-first vision — **how do you let a probabilistic model drive the books without ever letting it corrupt them?** The answer here is defense-in-depth: the AI proposes, but deterministic guardrails dispose. A wrong AI guess is structurally prevented from reaching the ledger.

Built to demonstrate:

- Constraining a probabilistic classifier with deterministic guardrails
- Domain-correct SA financial logic (VAT, owner funds, multi-tenancy)
- Vision + language extraction from messy real-world inputs
- Eval- and test-gated delivery

---

## The core idea: 5-layer owner-funds enforcement

The AI classifies each transaction, but **no single layer is trusted to be right.** Five independent layers each guard the books, so failure of any one cannot corrupt them:

1. **Rules-first classifier** — deterministic regex catches the common owner-funds cases (~80% of traffic) at zero API cost.
2. **LLM fallback** — anything unmatched goes to the model with a strict schema and a low-confidence floor.
3. **User confirmation modal** — when owner funds are suspected, the transaction is *not saved* until the user explicitly confirms Capital / Director's Loan / Override.
4. **Server-side enforcement** — `enforceOwnerFundsRules()` sets `direction`, `affectsProfit`, and `taxCode` from `kind`, regardless of what the client sent.
5. **PostgreSQL CHECK constraints** — the database rejects any row that violates owner-funds invariants, even via direct SQL. Last line of defence.

The result: capital and director's loans are structurally excluded from the P&L and VAT, and no single layer failing can change that.

---

## Where this could go

BookkeepGenie classifies every transaction from scratch — deterministic rules first, then a stateless LLM. It has no learned memory, and that's deliberate: models like [Digits](https://digits.com/) get their accuracy from scale — how *this* client, *this* firm, and *everyone else* classified similar transactions — and none of that signal exists on day one. With no history to learn from, correctness has to come from structure, which is exactly what the five enforcement layers provide.

A learned classification layer — per-client history first, then cross-client priors — is the natural next step as data accumulates, sitting *behind* the same five layers so a bad prior still can't corrupt the ledger. The enforcement stays constant; learning slots in as scale unlocks it.

---

## Capabilities

- AI receipt extraction (images + PDFs) via OpenAI vision
- Natural-language transaction entry ("Paid R1,500 to the plumber on the 3rd")
- **Voice entry** — record a note on the add-transaction page; it's transcribed via [Transcript Insights](https://github.com/AndrewLocke-pm/Transcript-Insights) (my Whisper → Claude service) and dropped into the same NL pipeline
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

Auth: Clerk (`@clerk/clerk-react` + `@clerk/express`).
Storage: PostgreSQL (10 tables); migrations in `migrations/`.
File uploads: Multer (memory for AI processing, disk for archival).
Voice: the browser calls the Transcript Insights `/transcribe` endpoint directly; everything else runs through this app's own server and OpenAI.

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

Required env vars: `DATABASE_URL`, `OPENAI_API_KEY`, `SESSION_SECRET`, `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`. Voice entry additionally uses `VITE_TI_API_URL` and `VITE_TI_CLIENT_API_KEY`.

---

## Further reading

- [`BookkeepGenie_PRODUCT.md`](./BookkeepGenie_PRODUCT.md) — what it does and the business logic
- [`BookkeepGenie_SYSTEM.md`](./BookkeepGenie_SYSTEM.md) — how it works internally
- [`server/tests/agent/SPEC.md`](./server/tests/agent/SPEC.md) — locked-in accounting decisions

---

Built as proof of work by [Andrew Locke](https://www.linkedin.com/in/andrew-b-locke/) — Technical PM and founder of [Sabrulo](https://www.sabrulo.com/), an independent AI product & strategy practice.
