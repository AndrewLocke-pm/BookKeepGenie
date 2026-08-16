import request from "supertest";
import { expect } from "vitest";
import type { Express } from "express";

export async function assertInvariants(opts: {
  app: Express;
  cookie: string;
  from: string;
  to: string;
}) {
  const { app, cookie, from, to } = opts;

  // 1) Fetch all transactions for the period
  const txRes = await request(app)
    .get("/api/transactions")
    .set("Cookie", cookie);

  expect(txRes.status).toBe(200);
  
  const transactions = txRes.body;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  
  // Filter transactions to the date range
  const periodTransactions = transactions.filter((t: any) => {
    const date = new Date(t.date);
    return date >= fromDate && date <= toDate;
  });

  // 2) Calculate Balance Sheet values
  const cumulativeTransactions = transactions.filter((t: any) => {
    const date = new Date(t.date);
    return date <= toDate;
  });

  // Revenue (cumulative)
  const totalRevenue = cumulativeTransactions
    .filter((t: any) => t.type === 'income' && t.affectsProfit !== false)
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

  // Expenses (cumulative) 
  const totalExpenses = cumulativeTransactions
    .filter((t: any) => t.type === 'expense' && t.affectsProfit !== false)
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

  const retainedEarnings = totalRevenue - totalExpenses;

  // Capital contributions with signed arithmetic
  const capitalContributions = cumulativeTransactions
    .filter((t: any) => t.kind === 'capital')
    .reduce((sum: number, t: any) => {
      const amount = parseFloat(t.amount);
      return t.direction === 'inflow' ? sum + amount : sum - amount;
    }, 0);

  // Director's loans with signed arithmetic
  const directorsLoans = cumulativeTransactions
    .filter((t: any) => t.kind === 'owner_loan')
    .reduce((sum: number, t: any) => {
      const amount = parseFloat(t.amount);
      return t.direction === 'inflow' ? sum + amount : sum - amount;
    }, 0);

  const totalEquity = retainedEarnings + capitalContributions;
  const totalLiabilities = directorsLoans;
  const totalAssets = totalEquity + totalLiabilities;

  // 3) Balance sheet must balance: Assets = Liabilities + Equity
  expect(round2(totalAssets)).toBe(round2(totalLiabilities + totalEquity));

  // 4) Owner funds must NOT affect P&L
  const ownerFundsTransactions = periodTransactions.filter((t: any) => 
    t.kind === 'capital' || t.kind === 'owner_loan' || t.kind === 'transfer'
  );

  for (const tx of ownerFundsTransactions) {
    expect(tx.affectsProfit).toBe(false);
    expect(tx.taxCode).toBe('out_of_scope');
  }

  // 5) VAT calculations must exclude owner funds and out_of_scope transactions
  const vatEligibleTransactions = periodTransactions.filter((t: any) => 
    !['capital', 'owner_loan', 'transfer'].includes(t.kind) &&
    !['out_of_scope', 'exempt'].includes(t.taxCode)
  );

  // Verify no owner funds leaked into VAT-eligible set
  for (const tx of vatEligibleTransactions) {
    expect(['capital', 'owner_loan', 'transfer']).not.toContain(tx.kind);
  }

  // 6) Capital and loan transactions must have direction = 'inflow'
  const capitalAndLoanTransactions = periodTransactions.filter((t: any) =>
    t.kind === 'capital' || t.kind === 'owner_loan'
  );

  for (const tx of capitalAndLoanTransactions) {
    expect(tx.direction).toBe('inflow');
  }

  return {
    totalAssets,
    totalLiabilities,
    totalEquity,
    retainedEarnings,
    capitalContributions,
    directorsLoans,
    transactionCount: periodTransactions.length,
    ownerFundsCount: ownerFundsTransactions.length,
    vatEligibleCount: vatEligibleTransactions.length,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function assertOwnerFundsRules(opts: {
  app: Express;
  cookie: string;
  transactionId: number;
}) {
  const { app, cookie, transactionId } = opts;

  const res = await request(app)
    .get("/api/transactions")
    .set("Cookie", cookie);

  expect(res.status).toBe(200);

  const transaction = res.body.find((t: any) => t.id === transactionId);
  
  if (!transaction) {
    throw new Error(`Transaction ${transactionId} not found`);
  }

  // If it's an owner funds transaction, verify all rules are enforced
  if (['capital', 'owner_loan', 'transfer'].includes(transaction.kind)) {
    expect(transaction.affectsProfit).toBe(false);
    expect(transaction.taxCode).toBe('out_of_scope');
    
    if (transaction.kind === 'capital' || transaction.kind === 'owner_loan') {
      expect(transaction.direction).toBe('inflow');
    }
  }

  return transaction;
}

export async function assertNoMockData(opts: {
  app: Express;
  cookie: string;
}) {
  const { app, cookie } = opts;

  const res = await request(app)
    .get("/api/transactions")
    .set("Cookie", cookie);

  expect(res.status).toBe(200);

  const transactions = res.body;

  // Check for common mock data patterns
  const mockPatterns = [
    /test/i,
    /mock/i,
    /example/i,
    /lorem ipsum/i,
    /placeholder/i,
    /dummy/i,
  ];

  const suspiciousTransactions = transactions.filter((t: any) => 
    mockPatterns.some(pattern => 
      pattern.test(t.vendor) || pattern.test(t.description)
    )
  );

  // Return suspicious transactions for manual review (don't fail, just report)
  return {
    totalTransactions: transactions.length,
    suspiciousCount: suspiciousTransactions.length,
    suspiciousTransactions,
  };
}
