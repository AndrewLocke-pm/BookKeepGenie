import { beforeAll, beforeEach, afterAll, test, expect, describe } from "vitest";
import type { Express } from "express";
import { getTestApp, closeTestApp } from "../setup";
import { createTestHelpers } from "../utils/testHelpers";
import request from "supertest";

let app: Express;
let cookie: string = "";
let categoryId: number;

describe("Golden Month Snapshot Tests", () => {
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
    categoryId = categories.find((c: any) => c.name === "Professional Services")?.id || categories[0]?.id;

    // Bulletproof reset check
    const list = await request(app)
      .get("/api/transactions")
      .set("Cookie", cookie);
    expect(list.body.length).toBe(0);
  });

  test("golden month reports match expected outputs", async () => {
    const h = createTestHelpers({ app, cookie, defaultCategoryId: categoryId });

    // Seed realistic October 2025 transactions
    // 1. Capital contribution (excluded from P&L and VAT)
    await h.createTx("capital", { amount: 50000, date: "2025-10-01", vendor: "Owner" });

    // 2. Director's loan (excluded from P&L and VAT)
    await h.createTx("owner_loan", { amount: 10000, date: "2025-10-02", vendor: "Director" });

    // 3. Standard income (VAT-inclusive R11,500 = R10,000 net + R1,500 VAT)
    await h.createTx("income", { 
      amount: 11500, 
      date: "2025-10-03", 
      vendor: "Client A",
      taxCode: "standard",
      taxRate: 15,
      taxInclusive: true 
    });

    // 4. Standard expense (VAT-inclusive R1,150 = R1,000 net + R150 VAT)
    await h.createTx("expense", { 
      amount: 1150, 
      date: "2025-10-04", 
      vendor: "Supplier B",
      taxCode: "standard",
      taxRate: 15,
      taxInclusive: true 
    });

    // 5. Zero-rated income (VATable but 0% - affects P&L)
    await h.createTx("income", { 
      amount: 5000, 
      date: "2025-10-05", 
      vendor: "Export Client",
      taxCode: "zero_rated",
      taxRate: 0,
      taxInclusive: true 
    });

    // 6. Exempt expense (affects P&L, excluded from VAT)
    await h.createTx("expense", { 
      amount: 2000, 
      date: "2025-10-06", 
      vendor: "Insurance Co",
      taxCode: "exempt",
      taxRate: 0,
      taxInclusive: true 
    });

    // 7. Out-of-scope expense (affects P&L, excluded from VAT)
    await h.createTx("expense", { 
      amount: 500, 
      date: "2025-10-07", 
      vendor: "International Vendor",
      taxCode: "out_of_scope",
      taxRate: 0,
      taxInclusive: true 
    });

    // Fetch reports
    const pl = await h.getPL("2025-10-01", "2025-10-31");
    const vat = await h.getVAT("2025-10-01", "2025-10-31");

    // P&L ASSERTIONS
    // Income: R11,500 + R5,000 = R16,500 (capital/loan excluded)
    expect(pl.totalIncome).toBe(16500);
    
    // Expenses: R1,150 + R2,000 + R500 = R3,650
    expect(pl.totalExpenses).toBe(3650);
    
    // Net Income: R16,500 - R3,650 = R12,850
    expect(pl.netIncome).toBe(12850);
    
    // Transaction count: 7 total
    expect(pl.transactionCount).toBe(7);
    
    // P&L transaction count: 5 (excludes capital + loan)
    expect(pl.pnlTransactionCount).toBe(5);

    // VAT ASSERTIONS
    // Output VAT: R11,500 × 15/115 = R1,500 (from standard income)
    // Zero-rated income has 0 VAT
    expect(vat.outputVat).toBeCloseTo(1500, 2);
    
    // Input VAT: R1,150 × 15/115 = R150 (from standard expense)
    // Exempt and out-of-scope expenses have 0 VAT
    expect(vat.inputVat).toBeCloseTo(150, 2);
    
    // VAT payable: R1,500 - R150 = R1,350
    expect(vat.vatPayable).toBeCloseTo(1350, 2);
    
    // Total transactions: 7
    expect(vat.totalTransactions).toBe(7);
    
    // VATable: 3 (standard income, standard expense, zero-rated income)
    expect(vat.vatableTransactionCount).toBe(3);
    
    // Excluded: 4 (capital, loan, exempt, out-of-scope)
    expect(vat.excludedTransactionCount).toBe(4);
  });

  test("refund scenario correctly reverses P&L", async () => {
    const h = createTestHelpers({ app, cookie, defaultCategoryId: categoryId });

    // Original expense
    await h.createTx("expense", { 
      amount: 1000, 
      date: "2025-10-10", 
      vendor: "Supplier",
      taxCode: "standard",
      taxRate: 15,
      taxInclusive: true,
      description: "Original purchase"
    });

    // Expense refund recorded as income
    await h.createTx("income", { 
      amount: 1000, 
      date: "2025-10-15", 
      vendor: "Supplier",
      taxCode: "standard",
      taxRate: 15,
      taxInclusive: true,
      description: "Refund for purchase"
    });

    const pl = await h.getPL("2025-10-01", "2025-10-31");
    const vat = await h.getVAT("2025-10-01", "2025-10-31");

    // Net P&L should be zero (expense cancelled by refund)
    expect(pl.netIncome).toBe(0);
    expect(pl.totalIncome).toBe(1000);
    expect(pl.totalExpenses).toBe(1000);

    // VAT should also net to zero
    expect(vat.vatPayable).toBeCloseTo(0, 2);
  });

  test("date boundaries are respected", async () => {
    const h = createTestHelpers({ app, cookie, defaultCategoryId: categoryId });

    // Jan 31 transaction
    await h.createTx("expense", { amount: 1000, date: "2025-01-31", vendor: "Jan Vendor" });
    
    // Feb 1 transaction
    await h.createTx("expense", { amount: 2000, date: "2025-02-01", vendor: "Feb Vendor" });

    // January should only include Jan 31
    const janPL = await h.getPL("2025-01-01", "2025-01-31");
    expect(janPL.totalExpenses).toBe(1000);
    expect(janPL.pnlTransactionCount).toBe(1);

    // February should only include Feb 1
    const febPL = await h.getPL("2025-02-01", "2025-02-28");
    expect(febPL.totalExpenses).toBe(2000);
    expect(febPL.pnlTransactionCount).toBe(1);
  });
});
