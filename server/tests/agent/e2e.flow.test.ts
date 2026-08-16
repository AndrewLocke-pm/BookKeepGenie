/**
 * E2E integration tests — full API flow via supertest
 *
 * Three scenarios:
 *   1. Normal expense  — NLP classifies "Paid R500 to Checkers for groceries"
 *                        as expense; transaction saves and appears in P&L.
 *   2. Owner funds modal flow — "Capital injection of R50,000 from owner"
 *                        triggers the owner-funds gate (rules-matched), returns
 *                        _requiresOwnerFundsDecision without saving, then a
 *                        re-POST with forceKind=capital saves with the correct
 *                        enforcement fields and is absent from P&L.
 *   3. Confidence fallback — OpenAI call rejects; classifyFromNLP falls through
 *                        to the hardcoded fallback (confidence=0.3, kind=expense).
 *
 * Mock strategy
 * ─────────────
 * vi.hoisted + vi.mock('openai') intercepts the OpenAI instance created inside
 * nlp/classifyTransaction.ts at module-load time. Each test configures mockCreate
 * for its own scenario; tests that rely on the rules engine (Test 2) never touch
 * the mock at all — the rule fires before any LLM call is attempted.
 *
 * The /api/process-nl endpoint is added to the getTestApp() Express instance
 * directly (Express apps are mutable). No existing files are modified.
 */

import { describe, test, beforeAll, beforeEach, afterEach, afterAll, expect, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { getTestApp, closeTestApp } from "./setup";
import { classifyFromNLP, enforceOwnerFundsRules } from "../../nlp/classifyTransaction";
import { insertTransactionSchema } from "@shared/schema";
import { storage } from "../../storage";

// ─── Mock OpenAI BEFORE any imports execute ──────────────────────────────────
//
// vi.hoisted() runs before the module graph is resolved so mockCreate is defined
// by the time the vi.mock factory runs and classifyTransaction.ts is imported.

const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  return { mockCreate };
});

vi.mock("openai", () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  }
  return { default: MockOpenAI };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Builds a minimal OpenAI JSON response that matches the classifier's schema. */
function openAIResponse(payload: {
  kind: string;
  direction: string;
  affects_profit: boolean;
  taxCode: string;
  confidence: number;
  reasoning?: string;
}) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify(payload),
        },
      },
    ],
  };
}

// ─── Shared state ─────────────────────────────────────────────────────────────

let app: Express;
let cookie: string;

// ─── /api/process-nl endpoint (added to existing test app) ───────────────────
//
// Implements the same NL-processing contract as the production POST /api/transactions:
//   1. Classify via classifyFromNLP
//   2. Gate on owner-funds kinds if no forceKind
//   3. Enforce owner-funds fields
//   4. Persist and return { ...transaction, _nlpClassification }

function attachProcessNlRoute(a: Express) {
  a.post("/api/process-nl", async (req: any, res: any) => {
    try {
      if (!req.isAuthenticated?.() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId: string = req.user.claims.sub;
      const { text, vendor, amount, date, categoryId, forceKind } = req.body;

      const user = await storage.getUser(userId);
      const currentUserName =
        `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() ||
        user?.email ||
        "";

      // ── Step 1: classify ────────────────────────────────────────────────────
      const classificationResult = await classifyFromNLP({
        text: text ?? "",
        vendor: vendor ?? "",
        currentUserName,
      });

      // ── Step 2: owner-funds gate ────────────────────────────────────────────
      if (
        ["capital", "owner_loan"].includes(classificationResult.kind) &&
        !forceKind
      ) {
        return res.json({
          _requiresOwnerFundsDecision: true,
          _nlpClassification: classificationResult,
          _pendingData: { vendor, text, amount, date },
        });
      }

      // ── Step 3: resolve fields ──────────────────────────────────────────────
      const effectiveKind = (forceKind ?? classificationResult.kind) as
        | "income"
        | "expense"
        | "capital"
        | "owner_loan"
        | "transfer"
        | "tax";

      const enforced = enforceOwnerFundsRules(effectiveKind);

      const resolvedDirection =
        enforced.direction ?? classificationResult.direction;
      const resolvedAffectsProfit =
        enforced.affectsProfit !== undefined
          ? enforced.affectsProfit
          : classificationResult.affectsProfit;
      const rawTaxCode = enforced.taxCode ?? classificationResult.taxCode;
      // 'unknown' is not a valid schema enum value — coerce to null
      const resolvedTaxCode =
        rawTaxCode === "unknown" || rawTaxCode === undefined
          ? null
          : (rawTaxCode as
              | "standard"
              | "zero_rated"
              | "exempt"
              | "out_of_scope");
      const resolvedType = resolvedDirection === "inflow" ? "income" : "expense";

      // ── Step 4: validate and persist ────────────────────────────────────────
      const validated = insertTransactionSchema.parse({
        userId,
        vendor: vendor ?? "Unknown",
        amount: String(amount),
        date: new Date(date ?? new Date().toISOString()),
        description: text ?? "",
        categoryId: categoryId != null ? Number(categoryId) : null,
        type: resolvedType,
        kind: effectiveKind,
        direction: resolvedDirection,
        affectsProfit: resolvedAffectsProfit,
        taxCode: resolvedTaxCode,
        taxInclusive: true,
        aiProcessed: 1,
        aiConfidence: String(classificationResult.confidence),
      });

      const transaction = await storage.createTransaction(validated);

      return res.status(201).json({
        ...transaction,
        _nlpClassification: classificationResult,
      });
    } catch (err: any) {
      console.error("[/api/process-nl]", err.message);
      return res.status(500).json({ message: err.message });
    }
  });
}

// ─── Suite setup ──────────────────────────────────────────────────────────────

beforeAll(async () => {
  app = await getTestApp();
  attachProcessNlRoute(app);
});

afterAll(async () => {
  await closeTestApp();
});

beforeEach(async () => {
  mockCreate.mockClear();
  await request(app).post("/api/test/reset");
  const loginRes = await request(app).post("/api/test/login");
  expect(loginRes.status).toBe(200);
  const raw = loginRes.headers["set-cookie"];
  cookie = Array.isArray(raw) ? raw.join("; ") : String(raw);
});

afterEach(async () => {
  await request(app).post("/api/test/reset");
});

// ─── Test 1 — Normal expense ──────────────────────────────────────────────────

describe("Test 1 — Normal expense", () => {
  test(
    "saves with kind=expense, affects_profit=true, and appears in P&L",
    async () => {
      // Arrange: mock LLM to return an expense classification
      mockCreate.mockResolvedValueOnce(
        openAIResponse({
          kind: "expense",
          direction: "outflow",
          affects_profit: true,
          taxCode: "standard",
          confidence: 0.92,
          reasoning: "Grocery purchase — standard business expense",
        })
      );

      // Act: submit the NL description
      const postRes = await request(app)
        .post("/api/process-nl")
        .set("Cookie", cookie)
        .send({
          text: "Paid R500 to Checkers for groceries",
          vendor: "Checkers",
          amount: "500",
          date: "2025-06-01",
        });

      // Assert: transaction was saved
      expect(postRes.status, JSON.stringify(postRes.body)).toBe(201);
      expect(postRes.body.id, "transaction must have a DB id").toBeTruthy();
      expect(postRes.body._requiresOwnerFundsDecision).toBeUndefined();

      const tx = postRes.body;
      expect(tx.kind).toBe("expense");
      expect(tx.affectsProfit).toBe(true);
      expect(tx.vendor).toBe("Checkers");
      expect(parseFloat(tx.amount)).toBeCloseTo(500, 1);

      // Assert: NLP classification metadata is present in the response
      expect(tx._nlpClassification).toBeDefined();
      expect(tx._nlpClassification.kind).toBe("expense");

      // Assert: transaction appears in the P&L report
      const plRes = await request(app)
        .get(
          `/api/reports/income-statement?from=2025-01-01&to=2025-12-31`
        )
        .set("Cookie", cookie);

      expect(plRes.status).toBe(200);
      expect(plRes.body.totalExpenses, "R500 must be reflected as an expense").toBeGreaterThan(0);
      expect(plRes.body.pnlTransactionCount, "expense must count toward P&L").toBeGreaterThan(0);
    }
  );
});

// ─── Test 2 — Owner funds modal flow ─────────────────────────────────────────
//
// "Capital injection" matches the rules regex (ownerFunds pattern) so the LLM
// is never called. No mock setup is required for this test.

describe("Test 2 — Owner funds modal flow", () => {
  test(
    "first POST returns _requiresOwnerFundsDecision without saving; re-POST with forceKind=capital saves and is absent from P&L",
    async () => {
      const NL_TEXT = "Capital injection of R50,000 from owner";

      // ── Step 1: initial POST (no forceKind) ─────────────────────────────────
      const gateRes = await request(app)
        .post("/api/process-nl")
        .set("Cookie", cookie)
        .send({
          text: NL_TEXT,
          vendor: "Owner",
          amount: "50000",
          date: "2025-06-01",
        });

      expect(gateRes.status, JSON.stringify(gateRes.body)).toBe(200);
      expect(gateRes.body._requiresOwnerFundsDecision).toBe(true);
      expect(gateRes.body._nlpClassification.kind).toBe("capital");
      expect(gateRes.body.id, "must NOT be saved on first POST").toBeUndefined();

      // Assert: nothing saved yet
      const ledger1 = await request(app)
        .get("/api/transactions")
        .set("Cookie", cookie);
      expect(ledger1.status).toBe(200);
      expect(ledger1.body, "ledger must be empty after gated response").toHaveLength(0);

      // ── Step 2: re-POST with forceKind=capital ───────────────────────────────
      const saveRes = await request(app)
        .post("/api/process-nl")
        .set("Cookie", cookie)
        .send({
          text: NL_TEXT,
          vendor: "Owner",
          amount: "50000",
          date: "2025-06-01",
          forceKind: "capital",
        });

      expect(saveRes.status, JSON.stringify(saveRes.body)).toBe(201);
      expect(saveRes.body.id, "transaction must be saved").toBeTruthy();

      const saved = saveRes.body;
      expect(saved.kind).toBe("capital");
      expect(saved.affectsProfit).toBe(false);
      expect(saved.taxCode).toBe("out_of_scope");

      // Assert: transaction IS in the ledger
      const ledger2 = await request(app)
        .get("/api/transactions")
        .set("Cookie", cookie);
      expect(ledger2.status).toBe(200);
      expect(ledger2.body).toHaveLength(1);

      // Assert: capital injection is NOT in P&L income/expense totals
      const plRes = await request(app)
        .get("/api/reports/income-statement?from=2025-01-01&to=2025-12-31")
        .set("Cookie", cookie);

      expect(plRes.status).toBe(200);
      expect(
        plRes.body.totalIncome,
        "capital injection must not inflate income"
      ).toBe(0);
      expect(
        plRes.body.totalExpenses,
        "capital injection must not inflate expenses"
      ).toBe(0);
      expect(
        plRes.body.pnlTransactionCount,
        "capital injection must not be counted in P&L transactions"
      ).toBe(0);
    }
  );
});

// ─── Test 3 — Confidence fallback ─────────────────────────────────────────────

describe("Test 3 — Confidence fallback (LLM timeout)", () => {
  test(
    "transaction still saves with kind=expense and confidence=0.3 when OpenAI rejects",
    async () => {
      // Arrange: simulate an OpenAI network failure / timeout
      mockCreate.mockRejectedValueOnce(new Error("Connection refused — simulated timeout"));

      // Act: text that matches no rule, so the classifier reaches the LLM path
      const postRes = await request(app)
        .post("/api/process-nl")
        .set("Cookie", cookie)
        .send({
          text: "Processing fee for merchant services",
          vendor: "PayFast",
          amount: "150",
          date: "2025-06-01",
        });

      // Assert: transaction was still saved despite LLM failure
      expect(postRes.status, JSON.stringify(postRes.body)).toBe(201);
      expect(postRes.body.id, "transaction must be saved via fallback path").toBeTruthy();

      const tx = postRes.body;

      // Fallback always classifies non-income text as expense
      expect(tx.kind).toBe("expense");
      expect(tx.affectsProfit).toBe(true);

      // aiConfidence column stores the numeric value from classificationResult
      expect(
        parseFloat(tx.aiConfidence),
        "fallback confidence must be 0.3"
      ).toBeCloseTo(0.3, 2);

      // _nlpClassification carries the full fallback metadata
      expect(tx._nlpClassification).toBeDefined();
      expect(tx._nlpClassification.confidence).toBe(0.3);
      expect(tx._nlpClassification.source).toBe("fallback");

      // Assert: the LLM was indeed called (and rejected) — not a rules hit
      expect(mockCreate).toHaveBeenCalledOnce();
    }
  );
});
