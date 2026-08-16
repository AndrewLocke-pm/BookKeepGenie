# System

## End-to-End Transaction Flow

```
1.  Browser           POST /api/process-receipt (multipart) or
                      POST /api/process-nl     (description)

2.  Express route     Multer parses upload, hands buffer to AI service.

3.  AI service        Image  → OpenAI GPT-4 Vision
                      PDF    → pdf-parse → OpenAI text completion
                      NL     → OpenAI text completion
                      Returns { vendor, amount, date, description, category, confidence }.

4.  NLP classifier    Runs rules first (regex). If no match, calls LLM.
                      Output: { kind, direction, affectsProfit, taxCode, confidence, source }.

5.  Decision gate     If kind ∈ {capital, owner_loan} AND no `forceKind` in request:
                          return { _requiresOwnerFundsDecision: true, _pendingData }
                          ──→ Frontend shows modal, re-submits with forceKind.
                      Else: continue to step 6.

6.  Server enforcement enforceOwnerFundsRules(kind) overrides direction / affectsProfit / taxCode.

7.  Persistence       Drizzle INSERT into transactions, scoped to userId + organisationId.

8.  DB constraints    PostgreSQL CHECK constraints reject any row that violates
                      owner-funds invariants. Final line of defence.

9.  Response          Saved transaction returned. React Query invalidates ledger cache.
```

## AI Pipeline

### Receipt / PDF / NL extraction

| Input | Path | Model |
|---|---|---|
| Image (JPEG/PNG/GIF/WebP) | Direct upload to vision model | GPT-4 Vision |
| PDF | `pdf-parse` text extract → text completion | GPT-4 |
| Plain English | Text completion | GPT-4 |

All calls use `response_format: { type: "json_object" }`, temperature 0, with a Zod schema validating the parsed result.

### Transaction Classification (Rules vs LLM)

Two-stage classifier in `server/nlp/`:

**Stage 1 — Rules (`rules.ts`)**
Deterministic regex patterns for the four common owner-funds cases:

| Pattern group | Matches |
|---|---|
| Capital contributions | "invest(ed/ment)", "capital contribution/injection", "equity injection", "paid in", "funded" |
| Director / shareholder loans | "director('s) loan", "shareholder loan", "loan to (the )?(business\|company)" |
| Transfers | "transfer between", "move funds", "transfer to/from" |
| Tax payments | "SARS", "VAT/PAYE/IRP6/EMP201 payment/remittance", "provisional tax" |
| Negative patterns | "invest in advertising/equipment" → returns null, lets LLM decide |

When a rule matches: return immediately. ~80% of real-world traffic. Zero API cost. Sub-millisecond.

**Stage 2 — LLM (`classifyTransaction.ts`)**
When no rule matches, call OpenAI with:
- `model: gpt-4o-mini`, `temperature: 0`, `max_tokens: 200`, JSON mode
- 8-second timeout; on failure, fall back to `{ kind: 'expense', confidence: 0.3 }`
- Response validated against Zod schema (`kind`, `direction`, `affects_profit`, `taxCode`, `confidence`)
- Disagreements between potential rule match and LLM output are logged for telemetry

## Owner-Funds Enforcement Layers

Five independent layers; failure of any single one cannot corrupt the books.

| # | Layer | Where |
|---|---|---|
| 1 | Rules-first classifier | `server/nlp/rules.ts` |
| 2 | LLM fallback with strict schema | `server/nlp/classifyTransaction.ts` |
| 3 | User confirmation modal (3 options + override warning) | `client/src/components/owner-funds-decision-modal.tsx` |
| 4 | `enforceOwnerFundsRules()` — sets `direction`, `affectsProfit`, `taxCode` based on `kind` regardless of client input | `server/routes.ts` |
| 5 | PostgreSQL CHECK constraints — reject illegal rows even via direct SQL | `shared/schema.ts` |

Constraint examples:

```sql
-- Owner funds must NOT affect profit
CHECK ((kind IN ('capital','owner_loan','transfer') AND affects_profit = false)
       OR kind NOT IN ('capital','owner_loan','transfer'))

-- Owner funds must be out_of_scope for VAT
CHECK ((kind IN ('capital','owner_loan','transfer') AND tax_code = 'out_of_scope')
       OR kind NOT IN ('capital','owner_loan','transfer'))

-- Capital and loans must be inflows
CHECK ((kind IN ('capital','owner_loan') AND direction = 'inflow')
       OR kind NOT IN ('capital','owner_loan'))
```

## Data Model

10 tables. Only the load-bearing fields are listed.

| Table | Key fields | Purpose |
|---|---|---|
| `users` | `id` (Clerk userId), `email`, `firstName`, `lastName`, `imageUrl` | Authenticated user |
| `sessions` | `sid`, `expire`, `sess` | Server-side session store |
| `organisations` | `id`, `name`, `vat_number`, `country` | Legal entity / trading name |
| `organisation_members` | `organisation_id`, `user_id`, `role`, `accepted_at` | Membership + roles (`owner` today; `member`/`viewer` later) |
| `categories` | `id`, `name`, `color`, `icon` | Global default categories |
| `system_categories` | `organisation_id`, `name` | Per-org owner-funds categories |
| `transactions` | `id`, `organisation_id`, `user_id`, `vendor`, `amount`, `date`, `description`, `category_id`, `type`, **`kind`**, **`direction`**, **`affects_profit`**, `tax_code`, `tax_rate`, `tax_inclusive`, `ai_confidence`, `receipt_path` | Core ledger |
| `tax_profiles` | `organisation_id`, VAT registration settings | VAT setup per org |
| `vat_returns` | `organisation_id`, period, totals | Finalised VAT201 submissions |
| `irp6_estimates` | `organisation_id`, period, taxable income | Provisional tax worksheets |

Five tables (`transactions`, `system_categories`, `tax_profiles`, `vat_returns`, `irp6_estimates`) carry a nullable `organisation_id` FK. When `organisation_id` is null the query degrades to `userId`-only filtering, preserving full backward compatibility with single-user accounts.

## Organisation Scoping

All read endpoints that touch the four data tables accept an optional `?organisationId=<n>` query parameter. Write endpoints (`POST /api/vat/finalize`, `POST /api/irp6/save`) also accept `organisationId` in the request body and persist it onto the new row.

`parseOrgId(raw)` in `routes.ts` is the single parsing point: returns `null` for absent or non-numeric values, so malformed params safely fall back to userId-only filtering.

Storage-layer contract: every method that filters rows accepts `organisationId?: number | null` as its last argument. When non-null, the WHERE clause becomes `userId AND organisationId`; when null, it is `userId` only. This is the defense-in-depth principle used throughout — `userId` is never removed, it is always the primary fence.

## Reports

All five reports read from `transactions`, scoped by `userId` and `organisationId` (when present), with filtering applied in `server/taxUtils.ts`:

| Report | What it shows | Inclusion rule |
|---|---|---|
| Income Statement | Revenue, expenses by category, net profit | `affects_profit = true` only |
| Balance Sheet | Assets, Liabilities, Equity *as at end date* | All transactions, signed arithmetic; A = L + E always holds |
| Cash Flow | Operating + Financing inflows/outflows | All transactions, grouped by `kind` |
| Trial Balance | Chronological ledger with Debit/Credit columns | All transactions |
| Management Accounts | KPIs + category breakdown | `affects_profit = true` for revenue/expense KPIs |

Custom date ranges are inclusive on both ends. Period-over-period comparisons are disabled for custom ranges to avoid misleading variance arrows.

## Authentication

Clerk handles all auth. Frontend wraps the app in `<ClerkProvider>` and uses `useUser()` via the `useAuth` hook. Backend uses `clerkMiddleware()` from `@clerk/express`; protected routes use the `isAuthenticated` middleware and call `getUserId(req)` to scope queries.

`/api/auth/user` returns the current Clerk user. There are no `/api/login` or `/api/logout` server routes — Clerk's `<SignInButton>` and `<SignOutButton>` handle session lifecycle client-side.

## Test Suite

Located in `server/tests/agent/`. Runs against the real database, scoped to `test-user-001`.

| File | Tests | Validates |
|---|---|---|
| `scenarios/capital.exclusion.test.ts` | 10 | Owner funds excluded from P&L and VAT |
| `scenarios/goldenMonth.test.ts` | 3 | Exact figures for a seeded realistic month |
| `scenarios/classifier.rules.test.ts` | 19 | NLP phrase coverage; prevents regex drift |
| `e2e.flow.test.ts` | 3 | Full upload → classify → save → report round-trip; owner-funds modal flow; LLM-timeout fallback |
| `multiorg.isolation.test.ts` | 5 | Data never leaks across organisation boundaries (ledger, P&L, VAT201, ID overlap) |
| `balanceSheet.fuzz.test.ts` | 1 (×50 runs) | A = L + E for randomly generated data |

**Total fast-suite tests (`npm run test:agent`): 40**

Three hard-coded safety rules in `setup.ts` and `multiorg.isolation.test.ts`: TEST_USER_ID is a `const`, resets use scoped DELETEs (never TRUNCATE), and the harness refuses to run unless `NODE_ENV=test` and `DATABASE_URL` does not contain `prod`.

Pre-deploy gate: `npm run test:agent` runs before every build. Test failure blocks the deployment.

## Key File Map

| Path | Role |
|---|---|
| `client/src/App.tsx` | Routing + ClerkProvider |
| `client/src/pages/{upload,transactions,reports,vat201,irp6}.tsx` | Main pages |
| `client/src/components/owner-funds-decision-modal.tsx` | Layer 3 confirmation UI |
| `server/routes.ts` | All API endpoints + Layer 4 enforcement + `parseOrgId()` helper |
| `server/clerkAuth.ts` | Auth middleware + `getUserId()` |
| `server/aiService.ts` | OpenAI vision + text wrappers |
| `server/nlp/rules.ts` | Layer 1 classifier patterns |
| `server/nlp/classifyTransaction.ts` | Layer 2 LLM classifier |
| `server/taxUtils.ts` | VAT201 / IRP6 / report filtering |
| `server/storage.ts` | `IStorage` interface + Drizzle implementation; all methods accept `organisationId?` |
| `shared/schema.ts` | Drizzle schema + Layer 5 CHECK constraints |
| `server/tests/agent/SPEC.md` | Locked-in accounting decisions |
| `client/src/pages/ui-preview/{dashboard,add-transaction}-preview.tsx` | Financial Hub redesign previews (see UI Redesign Previews) |
| `client/src/components/bookkeeper/` | Redesign component library (shell, ui primitives, owner-funds modal) |

## UI Redesign Previews

Two Clerk-authenticated preview routes showcase the "Financial Hub" redesign without touching the live pages:

- `/ui-preview/dashboard` — dark-sidebar dashboard: metric cards (Revenue, Expenses, Net Profit, Transactions), profit trend chart, VAT201 and IRP6 panels, recent transactions table. Uses real data and real organisation switching; VAT/IRP6 queries are org-scoped (`selectedOrgId` in the query key + `orgFetch`).
- `/ui-preview/add-transaction` — new add-transaction flow: receipt upload, natural-language entry, owner-funds confirmation modal.

Routing lives in a `PreviewRouter` in `client/src/App.tsx`; shared shell/components are under `client/src/components/bookkeeper/`. The redesign styles use `--bk-*` CSS variables. Once the design is approved, these pages are meant to replace the corresponding production pages.
