import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, getUserId } from "./clerkAuth";
import { extractFromImage, extractFromNaturalLanguage, extractFromPDF } from "./aiService";
import { insertTransactionSchema } from "@shared/schema";
import { transactionsToCSV } from "./exportService";
import { vatCalc, irp6Calc, deriveVatPeriods } from "./taxUtils";
import { classifyFromNLP, enforceOwnerFundsRules } from "./nlp/classifyTransaction";
import fs from "fs/promises";
import path from "path";
import { db } from "./db";
import { sql } from "drizzle-orm";

/** Parse an organisationId from any request field (query or body). Returns null when absent/invalid. */
function parseOrgId(raw: unknown): number | null {
  const n = parseInt(String(raw ?? ""), 10);
  return isNaN(n) ? null : n;
}

// Configure multer for file uploads (memory storage for temporary processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP images and PDF files are allowed.'));
    }
  },
});

// Configure multer for receipt storage in object storage
const receiptUpload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'public', 'receipts');
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error) {
        cb(error as Error, uploadDir);
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Initialize default categories on startup
  await storage.initializeDefaultCategories();

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    console.log('Clerk userId:', userId);  // temporary
    const user = await storage.getUser(userId);
    res.json({ isAuthenticated: true, user });
  });

  // Category routes
  app.get('/api/categories', isAuthenticated, async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // AI extraction endpoint
  app.post('/api/ai/extract', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const { naturalLanguage } = req.body;
      const uploadedFile = req.file;

      let extractionResult;

      if (uploadedFile) {
        // Check file type and extract accordingly
        if (uploadedFile.mimetype === 'application/pdf') {
          // Extract from PDF
          extractionResult = await extractFromPDF(uploadedFile.buffer);
        } else {
          // Extract from image using Vision AI
          const base64Image = uploadedFile.buffer.toString('base64');
          extractionResult = await extractFromImage(base64Image);
        }
      } else if (naturalLanguage) {
        // Extract from natural language
        extractionResult = await extractFromNaturalLanguage(naturalLanguage);
      } else {
        return res.status(400).json({ message: "Please provide a file (image/PDF) or natural language description" });
      }

      res.json(extractionResult);
    } catch (error: any) {
      console.error("Error extracting data:", error);
      res.status(500).json({ message: error.message || "Failed to extract data" });
    }
  });

  // Transaction routes
  app.get('/api/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseOrgId(req.query.organisationId);
      const transactions = await storage.getAllTransactions(userId, orgId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get('/api/transactions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const orgId = parseOrgId(req.query.organisationId);
      const transaction = await storage.getTransaction(id, userId, orgId);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json(transaction);
    } catch (error) {
      console.error("Error fetching transaction:", error);
      res.status(500).json({ message: "Failed to fetch transaction" });
    }
  });

  app.post('/api/transactions', isAuthenticated, receiptUpload.single('receiptImage'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      
      // Parse data - handle both FormData with 'data' field and direct JSON body
      let data;
      if (req.body.data) {
        data = JSON.parse(req.body.data);
      } else {
        // Direct JSON body (when no file upload)
        data = req.body;
      }
      
      const receiptFile = req.file;
      
      console.log("Transaction data received:", JSON.stringify(data, null, 2));

      // Run NLP classification if text description is provided
      let classificationResult;
      if (data.description || data.vendor) {
        const currentUserName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || '';
        classificationResult = await classifyFromNLP({
          text: data.description || '',
          vendor: data.vendor || '',
          currentUserName,
        });
        
        console.log("NLP classification result:", classificationResult);
      }
      
      // Check if NLP detected owner funds and user hasn't confirmed yet
      if (classificationResult && 
          ['capital', 'owner_loan'].includes(classificationResult.kind) &&
          !data.forceKind) {
        // Don't save yet - return classification for user confirmation
        return res.json({
          _requiresOwnerFundsDecision: true,
          _nlpClassification: classificationResult,
          _pendingData: {
            vendor: data.vendor,
            description: data.description,
            amount: data.amount,
          },
        });
      }
      
      // Apply forceKind if provided (user decision from modal)
      let finalData = { ...data };
      const forceKind = data.forceKind; // Extract before cleaning
      
      if (forceKind) {
        // User made an explicit decision, use it
        finalData.kind = forceKind;
        
        if (forceKind === 'expense') {
          // User overrode NLP classification - reset to normal expense defaults
          // This ensures P&L and VAT inclusion
          // CRITICAL: Unconditionally reset these fields even if present in payload
          finalData.affectsProfit = true;
          finalData.direction = 'outflow';
          
          // Only reset taxCode if it was 'out_of_scope' from owner funds classification
          // Preserve user-supplied tax codes (standard, zero_rated, etc.)
          if (finalData.taxCode === 'out_of_scope') {
            finalData.taxCode = 'unknown';
          }
          // If no taxCode provided at all, default to 'unknown'
          if (!finalData.taxCode) {
            finalData.taxCode = 'unknown';
          }
        } else {
          // Apply owner funds rules for capital, owner_loan, transfer, tax
          const enforced = enforceOwnerFundsRules(forceKind);
          finalData = { ...finalData, ...enforced };
        }
      } else if (finalData.kind) {
        // No user override, enforce rules based on the kind field
        const enforced = enforceOwnerFundsRules(finalData.kind);
        finalData = { ...finalData, ...enforced };
      }
      
      // Remove helper flags that aren't part of the schema
      const { forceKind: _, ...cleanData } = finalData;

      // Validate the transaction data
      const validated = insertTransactionSchema.parse({
        ...cleanData,
        userId,
        receiptUrl: receiptFile ? `/receipts/${receiptFile.filename}` : null,
      });

      const transaction = await storage.createTransaction(validated);
      
      // Include classification info in response (metadata, not saved)
      res.json({
        ...transaction,
        _nlpClassification: classificationResult,
      });
    } catch (error: any) {
      console.error("Error creating transaction:", error);
      console.error("Validation error details:", error.issues || error.message);
      res.status(400).json({ message: error.message || "Failed to create transaction" });
    }
  });

  app.patch('/api/transactions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      
      // Convert date string to Date object if present
      let updateData = { ...req.body };
      if (updateData.date && typeof updateData.date === 'string') {
        updateData.date = new Date(updateData.date);
      }
      
      // Enforce owner funds rules if kind is being set
      if (updateData.kind) {
        const enforced = enforceOwnerFundsRules(updateData.kind);
        updateData = { ...updateData, ...enforced };
      }
      
      const orgId = parseOrgId(req.query.organisationId);
      const transaction = await storage.updateTransaction(id, userId, updateData, orgId);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json(transaction);
    } catch (error: any) {
      console.error("Error updating transaction:", error);
      res.status(400).json({ message: error.message || "Failed to update transaction" });
    }
  });

  app.delete('/api/transactions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      
      const orgId = parseOrgId(req.query.organisationId);
      const deleted = await storage.deleteTransaction(id, userId, orgId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // Debug endpoint: classify transaction text
  app.get('/api/transactions/:id/classify', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id);
      const orgId = parseOrgId(req.query.organisationId);
      const user = await storage.getUser(userId);
      const transaction = await storage.getTransaction(id, userId, orgId);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      const currentUserName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || '';
      
      // Get classification result
      const classification = await classifyFromNLP({
        text: transaction.description || '',
        vendor: transaction.vendor || '',
        currentUserName,
      });
      
      res.json({
        transaction: {
          id: transaction.id,
          vendor: transaction.vendor,
          description: transaction.description,
          currentClassification: {
            kind: transaction.kind,
            direction: transaction.direction,
            affectsProfit: transaction.affectsProfit,
            taxCode: transaction.taxCode,
          },
        },
        classification,
        wouldTriggerModal: ['capital', 'owner_loan'].includes(classification.kind),
      });
    } catch (error: any) {
      console.error("Error classifying transaction:", error);
      res.status(500).json({ message: error.message || "Failed to classify transaction" });
    }
  });

  // Export route
  app.get('/api/transactions/export/csv', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseOrgId(req.query.organisationId);
      const transactions = await storage.getAllTransactions(userId, orgId);
      
      const csv = transactionsToCSV(transactions);
      const filename = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting transactions:", error);
      res.status(500).json({ message: "Failed to export transactions" });
    }
  });

  // Tax Profile routes
  app.get('/api/tax/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseOrgId(req.query.organisationId);
      const profile = await storage.getTaxProfile(userId, orgId);
      
      // Map vatStatus enum to vatRegistered boolean for frontend
      if (profile) {
        const { vatStatus, ...rest } = profile;
        res.json({
          ...rest,
          vatStatus,
          vatRegistered: vatStatus === 'registered',
        });
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Error fetching tax profile:", error);
      res.status(500).json({ message: "Failed to fetch tax profile" });
    }
  });

  app.post('/api/tax/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { vatRegistered, ...rest } = req.body;
      
      // Map vatRegistered boolean to vatStatus enum
      const vatStatus = vatRegistered ? 'registered' : 'not_registered';
      
      const profile = await storage.upsertTaxProfile({
        ...rest,
        vatStatus,
        userId,
      });
      res.json(profile);
    } catch (error: any) {
      console.error("Error saving tax profile:", error);
      res.status(400).json({ message: error.message || "Failed to save tax profile" });
    }
  });

  // VAT routes
  app.get('/api/vat/periods', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseOrgId(req.query.organisationId);
      const profile = await storage.getTaxProfile(userId, orgId);
      
      if (!profile) {
        return res.status(400).json({ message: "Please set up your tax profile first" });
      }

      const periods = deriveVatPeriods({
        filingFrequency: profile.vatPeriod || 'monthly',
        fyEndMonth: profile.financialYearEnd || 2, // Default Feb (SARS standard)
      });

      res.json(periods);
    } catch (error) {
      console.error("Error deriving VAT periods:", error);
      res.status(500).json({ message: "Failed to derive VAT periods" });
    }
  });

  app.post('/api/vat/calculate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { startDate, endDate } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      // Get all transactions for the user (optionally scoped to an org)
      const orgId = parseOrgId(req.body.organisationId ?? req.query.organisationId);
      const allTransactions = await storage.getAllTransactions(userId, orgId);

      // Filter transactions within the period
      const start = new Date(startDate);
      const end = new Date(endDate);
      const periodTransactions = allTransactions.filter(txn => {
        const txnDate = new Date(txn.date);
        return txnDate >= start && txnDate <= end;
      });

      // Calculate VAT
      const vatResult = vatCalc(periodTransactions);

      res.json(vatResult);
    } catch (error: any) {
      console.error("Error calculating VAT:", error);
      res.status(500).json({ message: error.message || "Failed to calculate VAT" });
    }
  });

  app.post('/api/vat/finalize', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { periodKey, startDate, endDate, outputVat, inputVat, netVat, worksheet } = req.body;

      if (!periodKey || !startDate || !endDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const orgId = parseOrgId(req.body.organisationId ?? req.query.organisationId);

      const vatReturn = await storage.createVatReturn({
        userId,
        ...(orgId != null ? { organisationId: orgId } : {}),
        periodKey,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        outputVat: outputVat?.toString() || '0',
        inputVat: inputVat?.toString() || '0',
        netVat: netVat?.toString() || '0',
        worksheet: worksheet || {},
        submittedAt: new Date(),
      });

      res.json(vatReturn);
    } catch (error: any) {
      console.error("Error finalizing VAT return:", error);
      
      // Check for unique constraint violation
      if (error.code === '23505') {
        return res.status(409).json({ 
          message: "A VAT return has already been filed for this period" 
        });
      }
      
      res.status(400).json({ message: error.message || "Failed to finalize VAT return" });
    }
  });

  app.get('/api/vat/returns', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseOrgId(req.query.organisationId);
      const returns = await storage.getVatReturns(userId, orgId);
      res.json(returns);
    } catch (error) {
      console.error("Error fetching VAT returns:", error);
      res.status(500).json({ message: "Failed to fetch VAT returns" });
    }
  });

  // VAT CSV export route
  app.post('/api/vat/export/csv', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { startDate, endDate, vatResult } = req.body;

      if (!vatResult || !vatResult.auditRows) {
        return res.status(400).json({ message: "VAT calculation result is required" });
      }

      // Generate CSV from audit rows
      const headers = ['Date', 'Vendor', 'Description', 'Type', 'Amount', 'Tax Code', 'Tax Rate %', 'Tax Inclusive', 'Supply Type', 'VAT Amount'];
      const rows = vatResult.auditRows.map((row: any) => [
        row.date,
        row.vendor,
        row.description || '',
        row.type,
        (row.amountCents / 100).toFixed(2),
        row.taxCode,
        (row.taxRate / 100).toFixed(2),
        row.taxInclusive ? 'Yes' : 'No',
        row.supplyType || '',
        (row.vatAmountCents / 100).toFixed(2),
      ]);

      const csvLines = [headers.join(','), ...rows.map(r => r.join(','))];
      const csv = csvLines.join('\n');

      const filename = `vat201_${startDate}_to_${endDate}.csv`;
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting VAT CSV:", error);
      res.status(500).json({ message: "Failed to export VAT CSV" });
    }
  });

  // IRP6 routes
  app.post('/api/irp6/calculate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { yoa, half, startDate, endDate, firstHalfPayment } = req.body;

      if (!yoa || !half || !startDate || !endDate) {
        return res.status(400).json({ message: "yoa, half, startDate, and endDate are required" });
      }

      // Get tax profile for legal form (optionally scoped to an org)
      const orgId = parseOrgId(req.body.organisationId ?? req.query.organisationId);
      const profile = await storage.getTaxProfile(userId, orgId);
      if (!profile) {
        return res.status(400).json({ message: "Please set up your tax profile first" });
      }

      // Get all transactions for the period
      const allTransactions = await storage.getAllTransactions(userId, orgId);
      const start = new Date(startDate);
      const end = new Date(endDate);
      const periodTransactions = allTransactions.filter(txn => {
        const txnDate = new Date(txn.date);
        return txnDate >= start && txnDate <= end;
      });

      // Calculate YTD income and expenses
      const ytdIncome = periodTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount) * 100, 0);
      
      const ytdExpenses = periodTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount) * 100, 0);

      // Calculate IRP6
      const irp6Result = irp6Calc({
        yoa,
        half,
        legalForm: profile.legalForm || 'sole_proprietor',
        ytdIncomeCents: Math.round(ytdIncome),
        ytdExpenseCents: Math.round(ytdExpenses),
        firstHalfPaymentCents: firstHalfPayment ? Math.round(firstHalfPayment * 100) : 0,
      });

      res.json(irp6Result);
    } catch (error: any) {
      console.error("Error calculating IRP6:", error);
      res.status(500).json({ message: error.message || "Failed to calculate IRP6" });
    }
  });

  app.post('/api/irp6/save', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { yearOfAssessment, half, taxableIncome, estimatedTax, worksheet } = req.body;

      if (!yearOfAssessment || !half) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const orgId = parseOrgId(req.body.organisationId ?? req.query.organisationId);

      const estimate = await storage.createIrp6Estimate({
        userId,
        ...(orgId != null ? { organisationId: orgId } : {}),
        yearOfAssessment,
        half,
        taxableIncome: taxableIncome?.toString() || '0',
        estimatedTax: estimatedTax?.toString() || '0',
        worksheet: worksheet || {},
        calculatedAt: new Date(),
      });

      res.json(estimate);
    } catch (error: any) {
      console.error("Error saving IRP6 estimate:", error);
      
      // Check for unique constraint violation
      if (error.code === '23505') {
        return res.status(409).json({ 
          message: "An IRP6 estimate has already been saved for this period" 
        });
      }
      
      res.status(400).json({ message: error.message || "Failed to save IRP6 estimate" });
    }
  });

  app.get('/api/irp6/estimates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgId = parseOrgId(req.query.organisationId);
      const estimates = await storage.getIrp6Estimates(userId, orgId);
      res.json(estimates);
    } catch (error) {
      console.error("Error fetching IRP6 estimates:", error);
      res.status(500).json({ message: "Failed to fetch IRP6 estimates" });
    }
  });

  // Organisation endpoints
  app.get('/api/organisations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const orgs = await storage.getOrganisationsByUser(userId);
      res.json(orgs);
    } catch (error) {
      console.error("Error fetching organisations:", error);
      res.status(500).json({ message: "Failed to fetch organisations" });
    }
  });

  app.get('/api/organisations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid organisation ID" });
      const org = await storage.getOrganisation(id, userId);
      if (!org) return res.status(404).json({ message: "Organisation not found" });
      res.json(org);
    } catch (error) {
      console.error("Error fetching organisation:", error);
      res.status(500).json({ message: "Failed to fetch organisation" });
    }
  });

  app.get('/api/organisations/:id/members', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid organisation ID" });
      const members = await storage.getOrganisationMembers(id, userId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching organisation members:", error);
      res.status(500).json({ message: "Failed to fetch organisation members" });
    }
  });

  // Test-only endpoints (only enabled in test/development)
  if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") {
    // Database reset endpoint
    app.post("/api/test/reset", async (req, res) => {
      try {
        // Truncate tables in correct order (respecting foreign key constraints)
        await db.execute(sql`TRUNCATE TABLE transactions RESTART IDENTITY CASCADE`);
        await db.execute(sql`TRUNCATE TABLE irp6_estimates RESTART IDENTITY CASCADE`);
        await db.execute(sql`TRUNCATE TABLE vat_returns RESTART IDENTITY CASCADE`);
        res.json({ ok: true });
      } catch (error: any) {
        console.error("Error resetting test database:", error);
        res.status(500).json({ ok: false, message: error.message });
      }
    });

    // Test login endpoint - creates a test user and establishes session
    app.post("/api/test/login", async (req: any, res) => {
      try {
        const testUserId = "test-user-001";
        
        // Check if user already exists
        let user = await storage.getUser(testUserId);
        
        if (!user) {
          // Create new test user
          user = await storage.upsertUser({
            id: testUserId,
            email: `test-${testUserId}@example.com`,
            firstName: "Test",
            lastName: "User",
            profileImageUrl: null,
          });
        }

        // Set up the session with claims matching what Replit OIDC provides
        req.user = {
          claims: {
            sub: testUserId,
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
          },
        };

        // Save the session
        req.login(req.user, (err: any) => {
          if (err) {
            console.error("Error logging in test user:", err);
            return res.status(500).json({ ok: false, message: err.message });
          }
          res.json({ ok: true, userId: testUserId });
        });
      } catch (error: any) {
        console.error("Error creating test login:", error);
        res.status(500).json({ ok: false, message: error.message });
      }
    });
  }

  const httpServer = createServer(app);
  return httpServer;
}
