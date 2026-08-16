# AI Bookkeeper Test Specification

## Design Decisions (Locked In)

### VAT Treatment in P&L

**Confirmed behavior (do not change):**

| VAT Mode | Amount Recorded | P&L Impact | Example |
|----------|-----------------|------------|---------|
| VAT-inclusive | Gross (full) amount | Full amount | R1,150 expense → R1,150 in P&L |
| VAT-exclusive | Net amount only | Net amount | R100 expense + R15 VAT → R100 in P&L |

This matches South African accounting practice where:
- Most businesses record transactions at gross (VAT-inclusive) amounts
- VAT is then calculated and claimed/paid separately
- The P&L shows what the business actually paid/received

### Owner Funds Rules

**Capital contributions and director loans:**
- `direction`: Always `inflow` (money coming in)
- `affectsProfit`: Always `false` (excluded from P&L)
- `taxCode`: Always `out_of_scope` (no VAT implications)

Server auto-corrects any attempt to set these values differently.

### VAT Classification

| Tax Code | Affects P&L | In VAT Calculation | VAT Rate |
|----------|-------------|-------------------|----------|
| standard | Yes | Yes | 15% |
| zero_rated | Yes | Yes | 0% |
| exempt | Yes | No | N/A |
| out_of_scope | Yes* | No | N/A |

*out_of_scope for owner funds: affectsProfit = false

### Refund Handling

Refunds are recorded as the opposite transaction type:
- Expense refund → Record as `income` (type="income")
- Income refund → Record as `expense` (type="expense")

This naturally reverses the P&L impact.

### Date Filtering

Date ranges are **inclusive** on both ends:
- `from=2025-01-01 to=2025-01-31` includes Jan 1 AND Jan 31
- Transaction on Jan 31 is IN January, not February

### Balance Sheet Equation

Must always hold: **Assets = Liabilities + Equity**

Where:
- Assets = Cash (all inflows minus all outflows)
- Liabilities = Director loans (to be repaid)
- Equity = Capital contributions + Retained earnings

### Multi-Tenant Data Isolation

**Confirmed behavior (do not change):**

All queries against `transactions`, `tax_profiles`, `vat_returns`, and `irp6_estimates` are scoped by **both** `userId` and `organisationId` when an `organisationId` is present on the request. The `userId` filter is never removed — it is defense-in-depth, not a fallback.

When `organisationId` is absent or null (legacy single-user accounts), the query degrades to `userId`-only filtering. No data loss, no behavioral change for existing single-org users.

Write endpoints (`POST /api/vat/finalize`, `POST /api/irp6/save`) persist the `organisationId` onto the new row so that subsequent reads with `?organisationId=` return the correct set.

**Isolation guarantee (verified by `multiorg.isolation.test.ts`):**

| Assertion | Expected result |
|---|---|
| Ledger `GET /api/transactions?organisationId=B` | 0 rows when all data is in org A |
| Income statement `GET /api/reports/income-statement?organisationId=B` | `totalIncome=0`, `totalExpenses=0`, `transactionCount=0` |
| VAT201 `GET /api/tax/vat201?organisationId=B` | `totalTransactions=0`, `vatableTransactionCount=0` |
| ID overlap check | No transaction ID from org A appears in any org B response |

`parseOrgId(raw)` in `routes.ts` is the canonical parsing point. Returns `null` for absent, empty, or non-numeric values so malformed params safely fall back to userId-only filtering without error.

## Test Categories

1. **Core tests** (`*.test.ts`): Fast, isolated, run on every commit — currently 40 tests across 5 files
2. **Fuzz tests** (`*.fuzz.test.ts`): Slow, property-based, run separately
3. **Classifier tests**: Ensure NLP rules don't drift

## Test Files

| File | Tests | What it guards |
|---|---|---|
| `scenarios/capital.exclusion.test.ts` | 10 | Owner funds excluded from P&L and VAT |
| `scenarios/goldenMonth.test.ts` | 3 | Exact figures for a seeded realistic month |
| `scenarios/classifier.rules.test.ts` | 19 | NLP phrase coverage; prevents regex drift |
| `e2e.flow.test.ts` | 3 | Full upload → classify → save → report round-trip |
| `multiorg.isolation.test.ts` | 5 | No data leaks across org boundaries |
| `balanceSheet.fuzz.test.ts` | 1 (×50 runs) | A = L + E for any random transaction mix |

## Running Tests

```bash
# Core tests (fast) — pre-deploy gate
NODE_ENV=test npm run test:agent

# Fuzz tests (slow)
NODE_ENV=test npm run test:agent:fuzz
```

## Test Harness Safety Rules

These rules are enforced in both `setup.ts` and `multiorg.isolation.test.ts`:

1. `TEST_USER_ID = "test-user-001"` is a TypeScript `const` — never derived from request input.
2. Cleanup uses scoped `DELETE WHERE userId = TEST_USER_ID` (or `DELETE WHERE name IN TEST_ORG_NAMES`) — `TRUNCATE` is never used.
3. The harness aborts unless `NODE_ENV=test` and `DATABASE_URL` does not contain `"prod"`.
