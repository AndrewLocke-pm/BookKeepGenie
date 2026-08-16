/**
 * Multi-tenant data isolation security test.
 *
 * Verifies that transactions scoped to organisation A cannot be read
 * through org-B-scoped endpoints, even though both orgs share the
 * same owning user (test-user-001).
 *
 * Uses the shared getTestApp() server from setup.ts — the same
 * storage layer that production routes.ts uses — so these assertions
 * exercise the real getAllTransactions / organisationId filter path.
 *
 * Safety rules (same as setup.ts):
 *   1. TEST_USER_ID is a TypeScript const; never derived from request input.
 *   2. Cleanup uses scoped DELETEs only (org cascade covers transactions
 *      and members). TRUNCATE is never used.
 *   3. Guards abort unless NODE_ENV=test and DATABASE_URL lacks "prod".
 */

import { describe, test, beforeAll, afterAll, expect } from "vitest";
import type { Express } from "express";
import request from "supertest";
import { db } from "../../db";
import { inArray } from "drizzle-orm";
import {
  organisations,
  organisationMembers,
  transactions,
  users,
} from "@shared/schema";
import { getTestApp, closeTestApp } from "./setup";

// ─── Safety constants ──────────────────────────────────────────────────────────

/** Never derived from request input — Rule 1. */
const TEST_USER_ID = "test-user-001" as const;
const ORG_A_NAME = "org-test-001" as const;
const ORG_B_NAME = "org-test-002" as const;
const TEST_ORG_NAMES = [ORG_A_NAME, ORG_B_NAME] as const;

// ─── Seed fixtures ────────────────────────────────────────────────────────────

/** Three transactions planted exclusively in org A. */
const ORG_A_SEEDS = [
  {
    vendor: "Org-A-Vendor-1",
    amount: "1000.00",
    description: "Office supplies — org A only",
    type: "expense" as const,
    kind: "expense" as const,
  },
  {
    vendor: "Org-A-Vendor-2",
    amount: "2500.00",
    description: "Professional services — org A only",
    type: "expense" as const,
    kind: "expense" as const,
  },
  {
    vendor: "Org-A-Vendor-3",
    amount: "500.00",
    description: "Revenue — org A only",
    type: "income" as const,
    kind: "income" as const,
  },
];

// ─── Shared state ─────────────────────────────────────────────────────────────

let orgAId: number;
let orgBId: number;
let app: Express;
let cookie: string;

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Multi-tenant data isolation — org A cannot leak into org B", () => {
  // ── Setup ──────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    // Rule 3: environment guards
    if (process.env.NODE_ENV !== "test") {
      throw new Error(
        "multiorg.isolation.test.ts must only run with NODE_ENV=test"
      );
    }
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    if (process.env.DATABASE_URL.toLowerCase().includes("prod")) {
      throw new Error(
        "Refusing to run isolation test against a database whose URL contains 'prod'"
      );
    }

    // Ensure the test user row exists (upsert is idempotent)
    await db
      .insert(users)
      .values({
        id: TEST_USER_ID,
        email: `${TEST_USER_ID}@test.invalid`,
        firstName: "Test",
        lastName: "User",
      })
      .onConflictDoNothing();

    // Rule 2: clean up any leftover rows from a previous aborted run
    await db
      .delete(organisations)
      .where(inArray(organisations.name, [...TEST_ORG_NAMES]));

    // Create the two test organisations
    const [orgA] = await db
      .insert(organisations)
      .values({ name: ORG_A_NAME })
      .returning();
    const [orgB] = await db
      .insert(organisations)
      .values({ name: ORG_B_NAME })
      .returning();

    orgAId = orgA.id;
    orgBId = orgB.id;

    // Register test user as owner of both orgs
    await db
      .insert(organisationMembers)
      .values([
        {
          organisationId: orgAId,
          userId: TEST_USER_ID,
          role: "owner",
          acceptedAt: new Date(),
        },
        {
          organisationId: orgBId,
          userId: TEST_USER_ID,
          role: "owner",
          acceptedAt: new Date(),
        },
      ])
      .onConflictDoNothing();

    // Seed 3 transactions into org A only
    await db.insert(transactions).values(
      ORG_A_SEEDS.map((t) => ({
        userId: TEST_USER_ID,
        organisationId: orgAId,
        vendor: t.vendor,
        amount: t.amount,
        date: new Date("2025-06-01"),
        description: t.description,
        type: t.type,
        kind: t.kind,
        direction: (t.type === "income" ? "inflow" : "outflow") as
          | "inflow"
          | "outflow",
        affectsProfit: true,
        taxCode: "standard" as const,
        taxRate: 1500,
        taxInclusive: true,
      }))
    );

    // Use the shared test app (real storage layer, same as production routes)
    app = await getTestApp();

    // Obtain a session cookie via the standard test login endpoint
    const loginRes = await request(app).post("/api/test/login");
    expect(loginRes.status).toBe(200);
    const rawCookies = loginRes.headers["set-cookie"];
    cookie = Array.isArray(rawCookies) ? rawCookies.join("; ") : String(rawCookies);
  }, 30_000);

  // ── Teardown ───────────────────────────────────────────────────────────────

  afterAll(async () => {
    // Rule 2: scoped DELETE only — cascade removes transactions + members
    await db
      .delete(organisations)
      .where(inArray(organisations.name, [...TEST_ORG_NAMES]));
    await closeTestApp();
  });

  // ── Sanity: verify the seed data exists in org A ───────────────────────────

  test("sanity — org A has exactly 3 seeded transactions", async () => {
    const res = await request(app)
      .get(`/api/transactions?organisationId=${orgAId}`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);

    for (const tx of res.body) {
      expect(tx.organisationId).toBe(orgAId);
      expect(tx.vendor).toMatch(/^Org-A-Vendor-/);
    }
  });

  // ── Isolation: org B endpoints must return nothing ─────────────────────────

  test("transaction ledger — org B returns 0 rows (no leak from org A)", async () => {
    const res = await request(app)
      .get(`/api/transactions?organisationId=${orgBId}`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);

    // Belt-and-suspenders: no org-A vendor name may appear
    const vendors: string[] = res.body.map((t: any) => String(t.vendor));
    for (const v of vendors) {
      expect(v).not.toMatch(/^Org-A-Vendor-/);
    }
  });

  test("income statement — org B reports zero income and zero expenses", async () => {
    const res = await request(app)
      .get(
        `/api/reports/income-statement?organisationId=${orgBId}&from=2025-01-01&to=2025-12-31`
      )
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.totalIncome).toBe(0);
    expect(res.body.totalExpenses).toBe(0);
    expect(res.body.transactionCount).toBe(0);
    expect(res.body.pnlTransactionCount).toBe(0);
  });

  test("VAT201 — org B reports zero vatable transactions", async () => {
    const res = await request(app)
      .get(
        `/api/tax/vat201?organisationId=${orgBId}&from=2025-01-01&to=2025-12-31`
      )
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.totalTransactions).toBe(0);
    expect(res.body.vatableTransactionCount).toBe(0);
  });

  // ── Strict ID non-overlap ──────────────────────────────────────────────────

  test("no org-A transaction ID appears in any org-B response", async () => {
    // Collect the actual DB ids seeded into org A
    const orgARes = await request(app)
      .get(`/api/transactions?organisationId=${orgAId}`)
      .set("Cookie", cookie);
    expect(orgARes.status).toBe(200);
    const orgAIds: number[] = orgARes.body.map((t: any) => t.id);
    expect(orgAIds).toHaveLength(3); // guard: confirms seed is intact

    // Collect org-B ids
    const orgBRes = await request(app)
      .get(`/api/transactions?organisationId=${orgBId}`)
      .set("Cookie", cookie);
    expect(orgBRes.status).toBe(200);
    const orgBIds: number[] = orgBRes.body.map((t: any) => t.id);

    // No ID from org A may appear in org B's result set
    const leaked = orgAIds.filter((id) => orgBIds.includes(id));
    expect(
      leaked,
      `Transactions with IDs [${leaked.join(", ")}] leaked from org A into org B response`
    ).toHaveLength(0);
  });
});
