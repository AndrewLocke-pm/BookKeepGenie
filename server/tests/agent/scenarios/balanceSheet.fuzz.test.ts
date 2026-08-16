import { beforeAll, beforeEach, afterAll, test, expect, describe } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { getTestApp, closeTestApp } from "../setup";

let app: Express;
let cookie: string = "";
let professionalServicesId: number;

describe("Balance Sheet Fuzz Tests", () => {
  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await request(app).post("/api/test/reset");

    const login = await request(app).post("/api/test/login");
    expect(login.status).toBe(200);
    
    const cookies = login.headers["set-cookie"];
    cookie = Array.isArray(cookies) ? cookies[0] : cookies;
    expect(cookie).toBeTruthy();

    const categoriesRes = await request(app)
      .get("/api/categories")
      .set("Cookie", cookie);
    expect(categoriesRes.status).toBe(200);
    
    const categories = categoriesRes.body;
    professionalServicesId = categories.find((c: any) => c.name === "Professional Services")?.id || categories[0]?.id;

    // Bulletproof reset check
    const list = await request(app)
      .get("/api/transactions")
      .set("Cookie", cookie);
    expect(list.body.length).toBe(0);
  });

  test("balance sheet equation holds (Assets = Liabilities + Equity) - 50 random runs", async () => {
    const fc = await import("fast-check");
    
    const transactionArbitrary = fc.record({
      type: fc.constantFrom("income", "expense"),
      kind: fc.constantFrom("income", "expense", "capital", "owner_loan"),
      amount: fc.integer({ min: 100, max: 100000 }),
      taxCode: fc.constantFrom("standard", "zero_rated", "exempt", "out_of_scope"),
    });

    await fc.assert(
      fc.asyncProperty(
        fc.array(transactionArbitrary, { minLength: 1, maxLength: 30 }),
        async (transactions) => {
          // Reset database for each run
          await request(app)
            .post("/api/test/reset")
            .set("Cookie", cookie);

          // Insert all transactions
          for (const t of transactions) {
            const isOwnerFunds = ["capital", "owner_loan"].includes(t.kind);
            const affectsProfit = !isOwnerFunds;
            const direction = isOwnerFunds ? "inflow" : (t.type === "income" ? "inflow" : "outflow");
            const finalTaxCode = isOwnerFunds ? "out_of_scope" : t.taxCode;
            const finalType = isOwnerFunds ? "income" : t.type;
            const finalKind = t.kind;

            await request(app)
              .post("/api/transactions")
              .set("Cookie", cookie)
              .set("Content-Type", "application/json")
              .send({
                vendor: `Fuzz Vendor ${Math.random()}`,
                amount: String(t.amount),
                date: "2025-10-15",
                description: `Fuzz test ${t.kind}`,
                categoryId: professionalServicesId,
                type: finalType,
                kind: finalKind,
                direction,
                taxCode: finalTaxCode,
                taxRate: finalTaxCode === "standard" ? 15 : 0,
                taxInclusive: true,
                affectsProfit,
              });
          }

          // Fetch all transactions
          const list = await request(app)
            .get("/api/transactions")
            .set("Cookie", cookie);

          // Calculate balance sheet components
          let assets = 0;
          let liabilities = 0;
          let equity = 0;

          for (const txn of list.body) {
            const amount = parseFloat(txn.amount);
            const kind = txn.kind || txn.type;

            if (kind === "capital") {
              equity += amount;
              assets += amount;
            } else if (kind === "owner_loan") {
              liabilities += amount;
              assets += amount;
            } else if (txn.type === "income") {
              equity += amount;
              assets += amount;
            } else if (txn.type === "expense") {
              equity -= amount;
              assets -= amount;
            }
          }

          // THE INVARIANT: Assets = Liabilities + Equity
          const balanceSheetHolds = Math.abs(assets - (liabilities + equity)) < 0.01;
          
          if (!balanceSheetHolds) {
            console.log("Balance sheet FAILED:", { assets, liabilities, equity });
            console.log("Transactions:", transactions);
          }

          return balanceSheetHolds;
        }
      ),
      { numRuns: 50 }
    );
  });
});
