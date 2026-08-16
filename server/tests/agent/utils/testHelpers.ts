import request from "supertest";
import type { Express } from "express";

export async function testLogin(app: Express): Promise<string> {
  const res = await request(app)
    .post("/api/test/login");
  
  if (res.status !== 200 || !res.body.ok) {
    throw new Error(`Failed to login test user: ${res.body.message || 'Unknown error'}`);
  }
  
  // Extract the session cookie from the response
  const cookies = res.headers["set-cookie"];
  if (!cookies || cookies.length === 0) {
    throw new Error("No session cookie received from test login");
  }
  
  // Return the cookie string for use in subsequent requests
  return Array.isArray(cookies) ? cookies.join("; ") : cookies;
}

export async function resetTestDatabase(app: Express, cookie?: string) {
  const req = request(app).post("/api/test/reset");
  
  if (cookie) {
    req.set("Cookie", cookie);
  }
  
  const res = await req;
  
  if (res.status !== 200 || !res.body.ok) {
    throw new Error(`Failed to reset test database: ${res.body.message || 'Unknown error'}`);
  }
  
  return res.body;
}

export async function createTestTransaction(app: Express, cookie: string, transaction: {
  vendor: string;
  amount: string;
  date: string;
  description: string;
  categoryId: number;
  type: 'income' | 'expense';
  kind?: 'expense' | 'income' | 'capital' | 'owner_loan' | 'transfer' | 'tax';
  direction?: 'inflow' | 'outflow';
  taxCode?: string;
  taxRate?: string;
  taxInclusive?: boolean;
}) {
  const res = await request(app)
    .post("/api/transactions")
    .set("Cookie", cookie)
    .send(transaction);
  
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Failed to create transaction: ${res.body.message || res.status}`);
  }
  
  return res.body;
}

export async function getTransactions(app: Express, cookie: string) {
  const res = await request(app)
    .get("/api/transactions")
    .set("Cookie", cookie);
  
  if (res.status !== 200) {
    throw new Error(`Failed to get transactions: ${res.body.message || res.status}`);
  }
  
  return res.body;
}

export async function deleteTransaction(app: Express, cookie: string, id: number) {
  const res = await request(app)
    .delete(`/api/transactions/${id}`)
    .set("Cookie", cookie);
  
  if (res.status !== 200 && res.status !== 204) {
    throw new Error(`Failed to delete transaction: ${res.body.message || res.status}`);
  }
  
  return res.body;
}

export async function updateTransaction(app: Express, cookie: string, id: number, updates: Partial<{
  vendor: string;
  amount: string;
  date: string;
  description: string;
  categoryId: number;
  type: 'income' | 'expense';
  kind: 'expense' | 'income' | 'capital' | 'owner_loan' | 'transfer' | 'tax';
  direction: 'inflow' | 'outflow';
  taxCode: string;
  taxRate: string;
  taxInclusive: boolean;
}>) {
  const res = await request(app)
    .patch(`/api/transactions/${id}`)
    .set("Cookie", cookie)
    .send(updates);
  
  if (res.status !== 200) {
    throw new Error(`Failed to update transaction: ${res.body.message || res.status}`);
  }
  
  return res.body;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getDateRange(daysBack: number = 30): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  
  return {
    from: formatDate(from),
    to: formatDate(to),
  };
}

type TransactionKind = "income" | "expense" | "capital" | "owner_loan" | "transfer" | "tax";

interface TxFields {
  amount?: number;
  vendor?: string;
  date?: string;
  description?: string;
  categoryId?: number;
  taxCode?: "standard" | "zero_rated" | "exempt" | "out_of_scope";
  taxRate?: number;
  taxInclusive?: boolean;
}

interface TestContext {
  app: Express;
  cookie: string;
  defaultCategoryId: number;
}

export function createTestHelpers(ctx: TestContext) {
  const { app, cookie, defaultCategoryId } = ctx;

  async function createTx(kind: TransactionKind, fields: TxFields = {}) {
    const isOwnerFunds = ["capital", "owner_loan", "transfer"].includes(kind);
    
    const type = isOwnerFunds ? "income" : (kind === "income" ? "income" : "expense");
    const direction = isOwnerFunds ? "inflow" : (type === "income" ? "inflow" : "outflow");
    const affectsProfit = !isOwnerFunds;
    const taxCode = isOwnerFunds ? "out_of_scope" : (fields.taxCode || "standard");
    const taxRate = isOwnerFunds ? 0 : (fields.taxRate ?? (taxCode === "standard" ? 15 : 0));

    const res = await request(app)
      .post("/api/transactions")
      .set("Cookie", cookie)
      .set("Content-Type", "application/json")
      .send({
        vendor: fields.vendor || `Test ${kind}`,
        amount: String(fields.amount || 1000),
        date: fields.date || "2025-10-15",
        description: fields.description || `Test ${kind} transaction`,
        categoryId: fields.categoryId || defaultCategoryId,
        type,
        kind,
        direction,
        taxCode,
        taxRate,
        taxInclusive: fields.taxInclusive ?? true,
        affectsProfit,
      });

    if (res.status !== 201) {
      throw new Error(`createTx failed: ${res.status} - ${JSON.stringify(res.body)}`);
    }
    return res.body;
  }

  async function getPL(from: string, to: string) {
    const res = await request(app)
      .get(`/api/reports/income-statement?from=${from}&to=${to}`)
      .set("Cookie", cookie);
    
    if (res.status !== 200) {
      throw new Error(`getPL failed: ${res.status} - ${JSON.stringify(res.body)}`);
    }
    return res.body;
  }

  async function getVAT(from: string, to: string) {
    const res = await request(app)
      .get(`/api/tax/vat201?from=${from}&to=${to}`)
      .set("Cookie", cookie);
    
    if (res.status !== 200) {
      throw new Error(`getVAT failed: ${res.status} - ${JSON.stringify(res.body)}`);
    }
    return res.body;
  }

  async function getBS(asOf: string) {
    const res = await request(app)
      .get(`/api/reports/balance-sheet?asOf=${asOf}`)
      .set("Cookie", cookie);
    
    if (res.status !== 200) {
      throw new Error(`getBS failed: ${res.status} - ${JSON.stringify(res.body)}`);
    }
    return res.body;
  }

  async function reset() {
    const res = await request(app)
      .post("/api/test/reset")
      .set("Cookie", cookie);
    
    if (res.status !== 200) {
      throw new Error(`reset failed: ${res.status}`);
    }
  }

  async function list() {
    const res = await request(app)
      .get("/api/transactions")
      .set("Cookie", cookie);
    
    if (res.status !== 200) {
      throw new Error(`list failed: ${res.status}`);
    }
    return res.body;
  }

  return { createTx, getPL, getVAT, getBS, reset, list };
}
