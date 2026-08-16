import { beforeAll, beforeEach, afterAll, test, expect, describe } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { getTestApp, closeTestApp } from "../setup";
import { assertInvariants } from "../utils/invariants";
import { createTestHelpers } from "../utils/testHelpers";

let app: Express;
let cookie: string = "";
let otherCategoryId: number;
let officeSuppliesId: number;
let professionalServicesId: number;
let utilitiesId: number;

describe("Capital Exclusion Tests", () => {
  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    // Reset database
    await request(app).post("/api/test/reset");

    // Login and get session cookie
    const login = await request(app).post("/api/test/login");
    expect(login.status).toBe(200);
    
    const cookies = login.headers["set-cookie"];
    cookie = Array.isArray(cookies) ? cookies[0] : cookies;
    expect(cookie).toBeTruthy();

    // Fetch categories
    const categoriesRes = await request(app)
      .get("/api/categories")
      .set("Cookie", cookie);
    expect(categoriesRes.status).toBe(200);
    
    const categories = categoriesRes.body;
    otherCategoryId = categories.find((c: any) => c.name === "Other")?.id || categories[0]?.id;
    officeSuppliesId = categories.find((c: any) => c.name === "Office Supplies")?.id || categories[0]?.id;
    professionalServicesId = categories.find((c: any) => c.name === "Professional Services")?.id || categories[0]?.id;
    utilitiesId = categories.find((c: any) => c.name === "Utilities")?.id || categories[0]?.id;

    // Bulletproof reset check
    const list = await request(app)
      .get("/api/transactions")
      .set("Cookie", cookie);
    expect(list.body.length).toBe(0);
  });

  test("capital contribution is excluded from P&L and VAT", async () => {
    // Create capital contribution
    const cap = await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({
        vendor: "Owner",
        amount: "100000.00",
        date: new Date("2025-10-01").toISOString(),
        description: "Capital contribution",
        categoryId: otherCategoryId,
        type: "income",
        kind: "capital",
        direction: "inflow",
        forceKind: "capital", // Force owner funds classification
      });

    expect([200, 201]).toContain(cap.status);
    
    // Verify capital transaction has correct flags
    expect(cap.body.affectsProfit).toBe(false);
    expect(cap.body.taxCode).toBe("out_of_scope");
    expect(cap.body.direction).toBe("inflow");
    expect(cap.body.kind).toBe("capital");

    // Create a normal expense
    const exp = await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .send({
        vendor: "Office Supplies Co",
        amount: "115",
        date: "2025-10-02",
        description: "Stationery",
        categoryId: officeSuppliesId,
        type: "expense",
        kind: "expense",
        direction: "outflow",
        taxCode: "standard",
        taxRate: 15,
        taxInclusive: true,
      });

    expect([200, 201]).toContain(exp.status);
    
    // Verify expense transaction has correct flags
    expect(exp.body.affectsProfit).toBe(true);
    expect(exp.body.kind).toBe("expense");

    // Prove transactions were actually created
    const list = await request(app)
      .get("/api/transactions")
      .set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(2);

    // Fetch P&L report and verify capital is excluded
    const pl = await request(app)
      .get("/api/reports/income-statement?from=2025-10-01&to=2025-10-31")
      .set("Cookie", cookie);
    expect(pl.status).toBe(200);
    
    // THE REAL PROOF: Capital contribution is NOT in P&L
    console.log("P&L body:", JSON.stringify(pl.body, null, 2));
    expect(pl.body.totalIncome).toBe(0); // Capital NOT counted as income
    expect(pl.body.totalExpenses).toBe(115); // Only the expense
    expect(pl.body.transactionCount).toBe(2); // Both transactions exist
    expect(pl.body.pnlTransactionCount).toBe(1); // Only expense affects P&L

    // Fetch VAT201 report and verify capital is excluded from VAT
    const vat = await request(app)
      .get("/api/tax/vat201?from=2025-10-01&to=2025-10-31")
      .set("Cookie", cookie);
    expect(vat.status).toBe(200);
    
    // THE REAL PROOF: Capital contribution is NOT in VAT calculations
    console.log("VAT body:", JSON.stringify(vat.body, null, 2));
    expect(vat.body.outputVat).toBe(0); // No income
    expect(vat.body.inputVat).toBe(15); // Only from R115 expense at 15% inclusive
    expect(vat.body.vatPayable).toBe(-15); // Refundable VAT
    expect(vat.body.totalTransactions).toBe(2); // Both transactions exist
    expect(vat.body.vatableTransactionCount).toBe(1); // Only expense is VATable
    expect(vat.body.excludedTransactionCount).toBe(1); // Capital excluded from VAT

    // Run invariants check
    const result = await assertInvariants({
      app,
      cookie,
      from: "2025-10-01",
      to: "2025-10-31",
    });

    // Verify capital is not in P&L-affecting transactions
    expect(result.ownerFundsCount).toBe(1);
    
    // Balance sheet should balance
    expect(result.totalAssets).toBe(result.totalLiabilities + result.totalEquity);
  });

  test("director loan is excluded from P&L and VAT", async () => {
    // Create director's loan
    const loan = await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .send({
        vendor: "Director",
        amount: "50000",
        date: "2025-10-01",
        description: "Director's loan to company",
        categoryId: otherCategoryId,
        type: "income",
        kind: "owner_loan",
        direction: "inflow",
        forceKind: "owner_loan",
      });

    expect([200, 201]).toContain(loan.status);
    
    // Verify loan transaction has correct flags
    expect(loan.body.affectsProfit).toBe(false);
    expect(loan.body.taxCode).toBe("out_of_scope");
    expect(loan.body.direction).toBe("inflow");
    expect(loan.body.kind).toBe("owner_loan");

    // Prove transaction was actually created
    const list = await request(app)
      .get("/api/transactions")
      .set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);

    // Run invariants check
    const result = await assertInvariants({
      app,
      cookie,
      from: "2025-10-01",
      to: "2025-10-31",
    });

    // Verify director loan is excluded from VAT
    expect(result.ownerFundsCount).toBe(1);
    expect(result.vatEligibleCount).toBe(0);
  });

  test("date filtering respects boundaries correctly", async () => {
    // Create transaction on Jan 31
    const jan31 = await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({
        vendor: "January Vendor",
        amount: "1000",
        date: "2025-01-31",
        description: "Last day of January",
        categoryId: professionalServicesId,
        type: "expense",
        kind: "expense",
        direction: "outflow",
        taxCode: "standard",
        taxRate: 15,
        taxInclusive: true,
      });

    expect([200, 201]).toContain(jan31.status);

    // Create transaction on Feb 1
    const feb1 = await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({
        vendor: "February Vendor",
        amount: "2000",
        date: "2025-02-01",
        description: "First day of February",
        categoryId: professionalServicesId,
        type: "expense",
        kind: "expense",
        direction: "outflow",
        taxCode: "standard",
        taxRate: 15,
        taxInclusive: true,
      });

    expect([200, 201]).toContain(feb1.status);

    // Verify both transactions exist
    const list = await request(app)
      .get("/api/transactions")
      .set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(2);

    // P&L for January only (Jan 1 - Jan 31)
    const plJan = await request(app)
      .get("/api/reports/income-statement?from=2025-01-01&to=2025-01-31")
      .set("Cookie", cookie);
    expect(plJan.status).toBe(200);
    console.log("P&L January:", JSON.stringify(plJan.body, null, 2));

    // THE PROOF: Only January transaction appears
    expect(plJan.body.totalExpenses).toBe(1000);
    expect(plJan.body.transactionCount).toBe(1);

    // P&L for February only (Feb 1 - Feb 28)
    const plFeb = await request(app)
      .get("/api/reports/income-statement?from=2025-02-01&to=2025-02-28")
      .set("Cookie", cookie);
    expect(plFeb.status).toBe(200);
    console.log("P&L February:", JSON.stringify(plFeb.body, null, 2));

    // THE PROOF: Only February transaction appears
    expect(plFeb.body.totalExpenses).toBe(2000);
    expect(plFeb.body.transactionCount).toBe(1);

    // VAT for January only
    const vatJan = await request(app)
      .get("/api/tax/vat201?from=2025-01-01&to=2025-01-31")
      .set("Cookie", cookie);
    expect(vatJan.status).toBe(200);

    // THE PROOF: Only January VAT (R1000 × 15/115 ≈ R130.43)
    expect(vatJan.body.totalTransactions).toBe(1);
    expect(vatJan.body.inputVat).toBeCloseTo(130.43, 1);

    // VAT for February only
    const vatFeb = await request(app)
      .get("/api/tax/vat201?from=2025-02-01&to=2025-02-28")
      .set("Cookie", cookie);
    expect(vatFeb.status).toBe(200);

    // THE PROOF: Only February VAT (R2000 × 15/115 ≈ R260.87)
    expect(vatFeb.body.totalTransactions).toBe(1);
    expect(vatFeb.body.inputVat).toBeCloseTo(260.87, 1);
  });

  test("refund reverses P&L and VAT correctly", async () => {
    // Create original expense: R115 VAT-inclusive
    const expense = await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({
        vendor: "Supplier A",
        amount: "115",
        date: "2025-10-10",
        description: "Original purchase",
        categoryId: professionalServicesId,
        type: "expense",
        kind: "expense",
        direction: "outflow",
        taxCode: "standard",
        taxRate: 15,
        taxInclusive: true,
      });

    expect([200, 201]).toContain(expense.status);

    // Create refund: Positive amount as income (money coming back)
    // Rule: Refunds are recorded as the opposite transaction type
    const refund = await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({
        vendor: "Supplier A",
        amount: "115", // Positive amount
        date: "2025-10-15",
        description: "Refund for original purchase",
        categoryId: professionalServicesId,
        type: "income", // Expense refund = income
        kind: "income",
        direction: "inflow",
        taxCode: "standard",
        taxRate: 15,
        taxInclusive: true,
      });

    expect([200, 201]).toContain(refund.status);

    // Verify both transactions exist
    const list = await request(app)
      .get("/api/transactions")
      .set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(2);

    // Fetch P&L - should net to 0
    const pl = await request(app)
      .get("/api/reports/income-statement?from=2025-10-01&to=2025-10-31")
      .set("Cookie", cookie);
    expect(pl.status).toBe(200);
    console.log("Refund P&L:", JSON.stringify(pl.body, null, 2));

    // THE PROOF: Expense R115 + Income R115 (refund) = Net Income 0
    // Rule: Refunds are opposite transaction type, so they offset in P&L
    expect(pl.body.totalExpenses).toBe(115);
    expect(pl.body.totalIncome).toBe(115);
    expect(pl.body.netIncome).toBe(0); // Income - Expenses = 0
    expect(pl.body.pnlTransactionCount).toBe(2);

    // Fetch VAT report
    const vat = await request(app)
      .get("/api/tax/vat201?from=2025-10-01&to=2025-10-31")
      .set("Cookie", cookie);
    expect(vat.status).toBe(200);
    console.log("Refund VAT:", JSON.stringify(vat.body, null, 2));

    // THE PROOF: Output VAT (from refund income) = Input VAT (from expense) = net 0
    expect(vat.body.inputVat).toBe(15); // From expense
    expect(vat.body.outputVat).toBe(15); // From refund income
    expect(vat.body.vatPayable).toBe(0); // 15 - 15 = 0
    expect(vat.body.vatableTransactionCount).toBe(2);
  });

  test("exempt supply affects P&L but excluded from VAT", async () => {
    // Create exempt income (e.g., rent received)
    const income = await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({
        vendor: "Tenant",
        amount: "8000",
        date: "2025-10-28",
        description: "Rental income - VAT exempt",
        categoryId: professionalServicesId,
        type: "income",
        kind: "income",
        direction: "inflow",
        taxCode: "exempt",
        taxRate: 0,
        taxInclusive: false,
        affectsProfit: true,
      });

    expect([200, 201]).toContain(income.status);

    // Verify transaction was created
    const list = await request(app)
      .get("/api/transactions")
      .set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);

    // Fetch P&L - exempt SHOULD affect profit
    const pl = await request(app)
      .get("/api/reports/income-statement?from=2025-10-01&to=2025-10-31")
      .set("Cookie", cookie);
    expect(pl.status).toBe(200);
    console.log("Exempt P&L:", JSON.stringify(pl.body, null, 2));

    // THE PROOF: Exempt income IS included in P&L
    expect(pl.body.totalIncome).toBe(8000);
    expect(pl.body.pnlTransactionCount).toBe(1);

    // Fetch VAT report
    const vat = await request(app)
      .get("/api/tax/vat201?from=2025-10-01&to=2025-10-31")
      .set("Cookie", cookie);
    expect(vat.status).toBe(200);
    console.log("Exempt VAT:", JSON.stringify(vat.body, null, 2));

    // THE PROOF: Exempt is EXCLUDED from VAT calculations
    expect(vat.body.outputVat).toBe(0);
    expect(vat.body.vatableTransactionCount).toBe(0); // NOT a VAT supply
    expect(vat.body.excludedTransactionCount).toBe(1); // Excluded from VAT
  });

  test("zero-rated supply affects P&L but not VAT", async () => {
    // Create zero-rated income (e.g., export sale)
    const income = await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({
        vendor: "Export Customer",
        amount: "5000",
        date: "2025-10-25",
        description: "Zero-rated export sale",
        categoryId: professionalServicesId,
        type: "income",
        kind: "income",
        direction: "inflow",
        taxCode: "zero_rated",
        taxRate: 0,
        taxInclusive: false,
        affectsProfit: true,
      });

    expect([200, 201]).toContain(income.status);

    // Verify transaction was created
    const list = await request(app)
      .get("/api/transactions")
      .set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);

    // Fetch P&L - zero-rated SHOULD affect profit
    const pl = await request(app)
      .get("/api/reports/income-statement?from=2025-10-01&to=2025-10-31")
      .set("Cookie", cookie);
    expect(pl.status).toBe(200);
    console.log("Zero-rated P&L:", JSON.stringify(pl.body, null, 2));

    // THE PROOF: Zero-rated income IS included in P&L
    expect(pl.body.totalIncome).toBe(5000);
    expect(pl.body.pnlTransactionCount).toBe(1);

    // Fetch VAT report
    const vat = await request(app)
      .get("/api/tax/vat201?from=2025-10-01&to=2025-10-31")
      .set("Cookie", cookie);
    expect(vat.status).toBe(200);
    console.log("Zero-rated VAT:", JSON.stringify(vat.body, null, 2));

    // THE PROOF: Zero-rated has 0% VAT but IS counted as VATable
    // (Zero-rated is still a VAT supply type, just at 0%)
    expect(vat.body.outputVat).toBe(0); // 0% rate = no VAT
    expect(vat.body.vatableTransactionCount).toBe(1); // Still a VAT supply
  });

  test("VAT-exclusive expense calculates correctly", async () => {
    // Create VAT-exclusive expense: R100 + 15% VAT = R115 total, R15 VAT
    const exp = await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({
        vendor: "VAT Exclusive Supplier",
        amount: "100", // Net amount (before VAT)
        date: "2025-10-20",
        description: "Test VAT exclusive calculation",
        categoryId: professionalServicesId,
        type: "expense",
        kind: "expense",
        direction: "outflow",
        taxCode: "standard",
        taxRate: 15,
        taxInclusive: false, // VAT EXCLUSIVE
      });

    expect([200, 201]).toContain(exp.status);

    // Verify transaction was created
    const list = await request(app)
      .get("/api/transactions")
      .set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);

    // Fetch VAT report
    const vat = await request(app)
      .get("/api/tax/vat201?from=2025-10-01&to=2025-10-31")
      .set("Cookie", cookie);
    expect(vat.status).toBe(200);
    console.log("VAT-exclusive body:", JSON.stringify(vat.body, null, 2));

    // THE PROOF: VAT-exclusive R100 at 15% = R15 input VAT
    expect(vat.body.inputVat).toBe(15);
    expect(vat.body.vatableTransactionCount).toBe(1);

    // Fetch P&L - should show R100 (net amount, before VAT)
    const pl = await request(app)
      .get("/api/reports/income-statement?from=2025-10-01&to=2025-10-31")
      .set("Cookie", cookie);
    expect(pl.status).toBe(200);
    console.log("P&L for VAT-exclusive:", JSON.stringify(pl.body, null, 2));

    // P&L shows the transaction amount as stored (R100 net)
    expect(pl.body.totalExpenses).toBe(100);
    expect(pl.body.pnlTransactionCount).toBe(1);
  });

  test("server enforces rules against malicious input", async () => {
    // ATTACK: Try to create capital with affectsProfit=true and taxCode=standard
    const malicious = await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({
        vendor: "Malicious Capital Injection",
        amount: "100000", // String to match schema
        date: "2025-10-15",
        description: "Trying to game the system",
        categoryId: professionalServicesId,
        type: "income",
        kind: "capital",
        direction: "outflow", // Wrong! Should be inflow
        affectsProfit: true, // Wrong! Should be false
        taxCode: "standard", // Wrong! Should be out_of_scope
        taxRate: 15,
        taxInclusive: true,
      });

    expect([200, 201]).toContain(malicious.status);
    
    // THE REAL PROOF: Server auto-corrected the malicious values
    expect(malicious.body.kind).toBe("capital");
    expect(malicious.body.affectsProfit).toBe(false); // Corrected!
    expect(malicious.body.taxCode).toBe("out_of_scope"); // Corrected!
    expect(malicious.body.direction).toBe("inflow"); // Corrected!

    // Verify it doesn't affect P&L
    const pl = await request(app)
      .get("/api/reports/income-statement?from=2025-10-01&to=2025-10-31")
      .set("Cookie", cookie);
    expect(pl.status).toBe(200);
    expect(pl.body.totalIncome).toBe(0); // Capital NOT counted
    expect(pl.body.pnlTransactionCount).toBe(0); // No transactions affect P&L

    // Verify it doesn't affect VAT
    const vat = await request(app)
      .get("/api/tax/vat201?from=2025-10-01&to=2025-10-31")
      .set("Cookie", cookie);
    expect(vat.status).toBe(200);
    expect(vat.body.vatableTransactionCount).toBe(0); // No VATable transactions
    expect(vat.body.excludedTransactionCount).toBe(1); // Capital excluded
  });

  // NOTE: Fuzz test moved to balanceSheet.fuzz.test.ts for isolation

  test("mixed transactions maintain balance sheet integrity", async () => {
    // Capital contribution
    await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .send({
        vendor: "Owner",
        amount: "100000",
        date: "2025-10-01",
        description: "Initial capital",
        categoryId: otherCategoryId,
        type: "income",
        kind: "capital",
        direction: "inflow",
        forceKind: "capital",
      });

    // Director's loan
    await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .send({
        vendor: "Director",
        amount: "25000",
        date: "2025-10-02",
        description: "Director loan",
        categoryId: otherCategoryId,
        type: "income",
        kind: "owner_loan",
        direction: "inflow",
        forceKind: "owner_loan",
      });

    // Normal income
    await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .send({
        vendor: "Client ABC",
        amount: "11500",
        date: "2025-10-05",
        description: "Consulting services",
        categoryId: professionalServicesId,
        type: "income",
        kind: "income",
        direction: "inflow",
        taxCode: "standard",
        taxRate: 15,
        taxInclusive: true,
      });

    // Normal expense
    await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .send({
        vendor: "Landlord",
        amount: "5000",
        date: "2025-10-10",
        description: "Office rent",
        categoryId: utilitiesId,
        type: "expense",
        kind: "expense",
        direction: "outflow",
        taxCode: "standard",
        taxRate: 15,
        taxInclusive: true,
      });

    // Prove all 4 transactions were actually created
    const list = await request(app)
      .get("/api/transactions")
      .set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(4);

    // Run invariants
    const result = await assertInvariants({
      app,
      cookie,
      from: "2025-10-01",
      to: "2025-10-31",
    });

    // 2 owner funds transactions (capital + loan)
    expect(result.ownerFundsCount).toBe(2);
    
    // 2 VAT-eligible transactions (income + expense with standard taxCode)
    expect(result.vatEligibleCount).toBe(2);
    
    // Capital contributions should be 100000
    expect(result.capitalContributions).toBe(100000);
    
    // Director's loans should be 25000
    expect(result.directorsLoans).toBe(25000);
    
    // Retained earnings = Revenue - Expenses = 11500 - 5000 = 6500
    expect(result.retainedEarnings).toBe(6500);
    
    // Total Equity = Retained + Capital = 6500 + 100000 = 106500
    expect(result.totalEquity).toBe(106500);
    
    // Total Liabilities = Director's Loans = 25000
    expect(result.totalLiabilities).toBe(25000);
    
    // Total Assets = Equity + Liabilities = 106500 + 25000 = 131500
    expect(result.totalAssets).toBe(131500);
    
    // Balance sheet must balance
    expect(result.totalAssets).toBe(result.totalLiabilities + result.totalEquity);
  });

  test("demo: helpers reduce boilerplate", async () => {
    // Initialize helpers with test context
    const h = createTestHelpers({ app, cookie, defaultCategoryId: professionalServicesId });

    // Create transactions with minimal code
    await h.createTx("capital", { amount: 50000 });
    await h.createTx("income", { amount: 10000 });
    await h.createTx("expense", { amount: 3000 });

    // Fetch reports with one-liners
    const pl = await h.getPL("2025-10-01", "2025-10-31");
    const vat = await h.getVAT("2025-10-01", "2025-10-31");

    // Verify capital excluded from P&L
    expect(pl.totalIncome).toBe(10000);
    expect(pl.totalExpenses).toBe(3000);
    expect(pl.netIncome).toBe(7000);

    // Verify capital excluded from VAT
    expect(vat.excludedTransactionCount).toBe(1); // Capital
    expect(vat.vatableTransactionCount).toBe(2);  // Income + Expense
  });
});
