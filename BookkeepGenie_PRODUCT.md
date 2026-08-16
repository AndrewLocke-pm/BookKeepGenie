# Product

## Problem

South African small business owners — especially sole traders and owner-managed companies — struggle with:

1. Receipts scattered across paper, email, and WhatsApp.
2. Capital contributions and director's loans accidentally landing on the P&L, distorting profit.
3. VAT being charged on transactions that should be out-of-scope.
4. Reports living in three different tools (spreadsheets, VAT calculator, accountant's software).

## Target Users

- Sole traders and owner-managed companies registered in South Africa
- Bookkeepers servicing multiple SME clients (each client is a separate organisation)
- Accountants needing a clean ledger before filing

## Core Features

| Feature | Outcome |
|---|---|
| Receipt upload (image/PDF) | Vendor, amount, date, category, and confidence score returned in seconds |
| Natural-language entry | Type "Paid R1,500 to plumber on the 3rd" → structured transaction |
| Transaction ledger | Sortable, filterable, CSV-exportable, inline-editable |
| Owner-funds classifier | Capital and director's loans correctly excluded from P&L and VAT |
| Five financial reports | P&L, Balance Sheet, Cash Flow, Trial Balance, Management Accounts |
| Custom date ranges | Any start/end date for interim, board, or campaign reporting |
| VAT201 + IRP6 | Tax-period filtering and exclusion rules built into every calculation |
| Multi-org scoping | All ledger, tax, and report queries accept an optional `organisationId`; data never crosses org boundaries |

## Primary User Flow

```
Upload receipt OR type description
        ↓
AI extracts vendor / amount / date / category
        ↓
NLP classifier inspects the description
        ↓
   ┌────┴────┐
   │         │
Owner funds  Normal expense/income
detected     saved straight away
   ↓
User picks Capital / Loan / Override
   ↓
Server enforces correct fields
   ↓
Transaction stored, reports update live
```

## Financial Logic Principles

### What affects profit

A transaction lands on the P&L **only if `affectsProfit = true`**. This is computed from the `kind` field, not chosen by the user directly.

| `kind` | On P&L? | Notes |
|---|---|---|
| `expense` | yes | Day-to-day operating cost |
| `income` | yes | Business revenue |
| `capital` | **no** | Owner equity injection |
| `owner_loan` | **no** | Director's loan to the business |
| `transfer` | **no** | Movement between own accounts |
| `tax` | **no** | SARS payments — not an operating expense |

### Owner funds (high level)

Capital contributions and director's loans look like income (cash in) but are **not revenue**. Treating them as revenue overstates profit and triggers VAT incorrectly.

The product handles this with five independent guardrails (see `BookkeepGenie_SYSTEM.md` for details). The user-facing layer is a confirmation modal: when the AI suspects owner funds, the transaction is **not saved** until the user explicitly chooses Capital, Director's Loan, or Override (with a second warning).

### VAT (high level)

- Amounts are recorded **VAT-inclusive** (gross). VAT is calculated and reported separately. This matches South African convention.
- Each transaction carries a `taxCode`: `standard` (15%), `zero_rated`, `exempt`, or `out_of_scope`.
- VAT201 calculations exclude any transaction where `kind ∈ {capital, owner_loan, transfer, tax}` **or** `taxCode ∈ {out_of_scope, exempt}`.
- Refunds are recorded as the opposite transaction type — they naturally reverse the original P&L impact without special handling.

### Date ranges

All filtering is **inclusive on both ends**. A transaction dated 31 January falls inside January, not February.

### Multi-tenancy

Every query that touches `transactions`, `tax_profiles`, `vat_returns`, or `irp6_estimates` is scoped by both `userId` and `organisationId`. When `organisationId` is absent (legacy single-user accounts) the filter degrades gracefully to `userId` only — so existing data is never broken.

Write endpoints (`POST /api/vat/finalize`, `POST /api/irp6/save`) also persist the `organisationId` onto the new row so that subsequent reads return the correct data for each organisation.
