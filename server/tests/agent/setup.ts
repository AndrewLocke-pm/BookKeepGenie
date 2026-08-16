import express from "express";
import session from "express-session";
import passport from "passport";
import { createServer } from "http";
import { storage } from "../../storage";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { insertTransactionSchema } from "@shared/schema";
import { classifyFromNLP, enforceOwnerFundsRules } from "../../nlp/classifyTransaction";

// =============================================================================
// RULE 1: Test user ID is HARD-CODED and NEVER configurable
// =============================================================================
const TEST_USER_ID = "test-user-001" as const;

let appInstance: express.Express | null = null;
let serverInstance: any = null;

export async function getTestApp(): Promise<express.Express> {
  if (appInstance) {
    return appInstance;
  }

  // =============================================================================
  // RULE 3: Environment safety assertions - MUST run before anything else
  // =============================================================================
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Test app can only be created in NODE_ENV=test");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing in test env");
  }

  if (process.env.DATABASE_URL.toLowerCase().includes("prod")) {
    throw new Error("Refusing to run tests against prod database");
  }

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  
  // Simple test session setup (no OIDC)
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "test-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false, // false for tests
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // Initialize default categories
  await storage.initializeDefaultCategories();

  // =============================================================================
  // Test-only endpoints (already environment-gated by NODE_ENV check above)
  // =============================================================================
  
  // RULE 2: Reset MUST filter by TEST_USER_ID - NEVER truncate or delete all
  app.post("/api/test/reset", async (req, res) => {
    try {
      // SAFETY: Only delete test user's data using hard-coded TEST_USER_ID
      await db.execute(sql`DELETE FROM transactions WHERE user_id = ${TEST_USER_ID}`);
      await db.execute(sql`DELETE FROM irp6_estimates WHERE user_id = ${TEST_USER_ID}`);
      await db.execute(sql`DELETE FROM vat_returns WHERE user_id = ${TEST_USER_ID}`);
      res.json({ ok: true, scopedTo: TEST_USER_ID });
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.post("/api/test/login", async (req: any, res) => {
    try {
      // RULE 1: Always use hard-coded TEST_USER_ID, never from request
      let user = await storage.getUser(TEST_USER_ID);

      if (!user) {
        user = await storage.upsertUser({
          id: TEST_USER_ID,
          email: `test-${TEST_USER_ID}@example.com`,
          firstName: "Test",
          lastName: "User",
          profileImageUrl: null,
        });
      }

      req.user = {
        claims: {
          sub: TEST_USER_ID,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
        },
      };

      req.login(req.user, (err: any) => {
        if (err) {
          return res.status(500).json({ ok: false, message: err.message });
        }
        res.json({ ok: true, userId: TEST_USER_ID });
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  // Simple auth middleware for tests
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  };

  // Categories endpoint
  app.get("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Transactions endpoints
  app.get("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orgId = req.query.organisationId ? parseInt(String(req.query.organisationId), 10) : null;
      const transactions = await storage.getAllTransactions(userId, isNaN(orgId as number) ? null : orgId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let transactionData = { ...req.body, userId };

      // Handle forceKind for owner funds
      if (req.body.forceKind) {
        transactionData.kind = req.body.forceKind;
        delete transactionData.forceKind;
      }

      // Apply owner funds enforcement rules (function returns partial overrides based on kind)
      const kind = transactionData.kind || 'expense';
      const ownerFundsOverrides = enforceOwnerFundsRules(kind);
      transactionData = { ...transactionData, ...ownerFundsOverrides };

      // Parse and validate
      const parsed = insertTransactionSchema.safeParse(transactionData);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid transaction data", errors: parsed.error.errors });
      }

      const transaction = await storage.createTransaction(parsed.data);
      res.status(201).json(transaction);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to create transaction" });
    }
  });

  app.patch("/api/transactions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      let updates = { ...req.body };

      // Apply owner funds enforcement rules
      updates = enforceOwnerFundsRules(updates);

      const transaction = await storage.updateTransaction(id, userId, updates);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update transaction" });
    }
  });

  // VAT201 Report endpoint for testing
  app.get("/api/tax/vat201", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { from, to } = req.query;
      const rawOrg = req.query.organisationId;
      const orgId = rawOrg ? parseInt(String(rawOrg), 10) : null;

      const transactions = await storage.getAllTransactions(userId, isNaN(orgId as number) ? null : orgId);
      
      // Filter to date range
      const fromDate = new Date(from as string);
      const toDate = new Date(to as string);
      
      const filtered = transactions.filter(t => {
        const date = new Date(t.date);
        return date >= fromDate && date <= toDate;
      });
      
      // Exclude owner funds and out_of_scope/exempt from VAT calculations
      const vatableTransactions = filtered.filter(t => {
        const kind = t.kind || (t.type === 'income' ? 'income' : 'expense');
        const isOwnerFunds = ['capital', 'owner_loan', 'transfer'].includes(kind);
        const isExcludedTaxCode = ['out_of_scope', 'exempt'].includes(t.taxCode || '');
        return !isOwnerFunds && !isExcludedTaxCode;
      });
      
      // Calculate output VAT (from sales/income)
      const outputVat = vatableTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => {
          const rate = t.taxRate || 0;
          const amount = parseFloat(t.amount);
          if (t.taxInclusive) {
            return sum + (amount * rate / (100 + rate));
          }
          return sum + (amount * rate / 100);
        }, 0);
      
      // Calculate input VAT (from purchases/expenses)
      const inputVat = vatableTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => {
          const rate = t.taxRate || 0;
          const amount = parseFloat(t.amount);
          if (t.taxInclusive) {
            return sum + (amount * rate / (100 + rate));
          }
          return sum + (amount * rate / 100);
        }, 0);
      
      res.json({
        outputVat: Math.round(outputVat * 100) / 100,
        inputVat: Math.round(inputVat * 100) / 100,
        vatPayable: Math.round((outputVat - inputVat) * 100) / 100,
        totalTransactions: filtered.length,
        vatableTransactionCount: vatableTransactions.length,
        excludedTransactionCount: filtered.length - vatableTransactions.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // P&L Report endpoint for testing
  app.get("/api/reports/income-statement", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { from, to } = req.query;
      const rawOrg = req.query.organisationId;
      const orgId = rawOrg ? parseInt(String(rawOrg), 10) : null;

      const transactions = await storage.getAllTransactions(userId, isNaN(orgId as number) ? null : orgId);
      
      // Filter to date range
      const fromDate = new Date(from as string);
      const toDate = new Date(to as string);
      
      const filtered = transactions.filter(t => {
        const date = new Date(t.date);
        return date >= fromDate && date <= toDate;
      });
      
      // Calculate P&L - only include transactions where affectsProfit is true
      const income = filtered
        .filter(t => t.type === 'income' && t.affectsProfit !== false)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const expenses = filtered
        .filter(t => t.type === 'expense' && t.affectsProfit !== false)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      res.json({
        totalIncome: income,
        totalExpenses: expenses,
        netIncome: income - expenses,
        transactionCount: filtered.length,
        pnlTransactionCount: filtered.filter(t => t.affectsProfit !== false).length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/transactions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteTransaction(id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete transaction" });
    }
  });

  serverInstance = createServer(app);
  appInstance = app;

  return app;
}

export async function closeTestApp() {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
  appInstance = null;
}
