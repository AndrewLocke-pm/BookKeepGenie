import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  integer,
  boolean,
  uniqueIndex,
  check,
  serial,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Organisations table
export const organisations = pgTable('organisations', {
  id:         serial('id').primaryKey(),
  name:       varchar('name', { length: 255 }).notNull(),
  vatNumber:  varchar('vat_number', { length: 20 }),
  country:    varchar('country', { length: 2 }).notNull().default('ZA'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
  updatedAt:  timestamp('updated_at').defaultNow().notNull(),
});

export type Organisation = typeof organisations.$inferSelect;
export type InsertOrganisation = typeof organisations.$inferInsert;

// Organisation members table
export const organisationMembers = pgTable('organisation_members', {
  id:             serial('id').primaryKey(),
  organisationId: integer('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  userId:         varchar('user_id', { length: 255 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:           varchar('role', { length: 20 }).notNull().default('owner'),
  invitedAt:      timestamp('invited_at').defaultNow().notNull(),
  acceptedAt:     timestamp('accepted_at'),
}, (table) => ({
  uniq: unique().on(table.organisationId, table.userId),
}));

export type OrganisationMember = typeof organisationMembers.$inferSelect;
export type InsertOrganisationMember = typeof organisationMembers.$inferInsert;

// Transaction categories
export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  color: varchar("color", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
}));

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// System Categories table - predefined categories for owner funds
export const systemCategories = pgTable("system_categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organisationId: integer("organisation_id").references(() => organisations.id, { onDelete: 'cascade' }),
  code: varchar("code", { length: 50 }).notNull(), // 'owner_funds_in', 'directors_loan_in', etc.
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_system_categories_user_id").on(table.userId),
  uniqueIndex("idx_system_categories_user_code").on(table.userId, table.code),
]);

export type SystemCategory = typeof systemCategories.$inferSelect;
export type InsertSystemCategory = typeof systemCategories.$inferInsert;

// Transactions table
export const transactions = pgTable("transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: timestamp("date").notNull(),
  vendor: varchar("vendor", { length: 255 }).notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  type: varchar("type", { length: 20 }).notNull(), // 'expense' or 'income'
  receiptUrl: text("receipt_url"),
  aiProcessed: integer("ai_processed").default(0), // 0 = manual, 1 = AI processed
  aiConfidence: decimal("ai_confidence", { precision: 3, scale: 2 }), // 0.00 to 1.00
  notes: text("notes"),
  organisationId: integer("organisation_id").references(() => organisations.id, { onDelete: 'cascade' }),
  // Classification fields for owner funds tracking
  direction: varchar("direction", { length: 20 }).default('outflow'), // 'inflow' or 'outflow'
  kind: varchar("kind", { length: 20 }).default('expense'), // 'income', 'expense', 'capital', 'owner_loan', 'transfer', 'tax'
  affectsProfit: boolean("affects_profit").default(true), // false for capital, owner_loan, transfer
  // Tax fields for SA compliance
  taxCode: varchar("tax_code", { length: 20 }), // 'standard', 'zero_rated', 'exempt', 'out_of_scope'
  taxRate: integer("tax_rate"), // in basis points (1500 = 15%)
  taxInclusive: boolean("tax_inclusive").default(true), // true if amount includes VAT
  supplyType: varchar("supply_type", { length: 50 }), // 'goods', 'services', 'import', 'export', 'capital'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_transactions_user_id").on(table.userId),
  index("idx_transactions_date").on(table.date),
  index("idx_transactions_category_id").on(table.categoryId),
  index("idx_transactions_kind").on(table.kind),
  // CHECK constraints to prevent illegal states
  check("chk_capital_no_pnl", sql`NOT (kind IN ('capital', 'owner_loan', 'transfer') AND affects_profit = TRUE)`),
  check("chk_capital_tax_outscope", sql`NOT (kind IN ('capital', 'owner_loan', 'transfer') AND tax_code IS NOT NULL AND tax_code <> 'out_of_scope')`),
]);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

export const insertTransactionSchema = createInsertSchema(transactions, {
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid decimal"),
  date: z.coerce.date(),
  vendor: z.string().min(1, "Vendor is required"),
  type: z.enum(['expense', 'income']),
  aiConfidence: z.union([z.string(), z.number()]).optional().nullable(),
  direction: z.enum(['inflow', 'outflow']).optional(),
  kind: z.enum(['income', 'expense', 'capital', 'owner_loan', 'transfer', 'tax']).optional(),
  affectsProfit: z.boolean().optional(),
  taxCode: z.enum(['standard', 'zero_rated', 'exempt', 'out_of_scope']).optional().nullable(),
  taxInclusive: z.boolean().optional(),
  supplyType: z.enum(['goods', 'services', 'import', 'export', 'capital']).optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// API response types
export type TransactionWithCategory = Transaction & {
  category: Category | null;
};

export type AIExtractionResult = {
  vendor: string;
  amount: string;
  date: string;
  description: string;
  category: string;
  confidence: number;
  type: "expense" | "income";
  taxCode: "standard" | "zero_rated" | "exempt" | "out_of_scope";
};

// Tax Profile table - stores tax settings per user
export const taxProfiles = pgTable("tax_profiles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  legalForm: varchar("legal_form", { length: 50 }).notNull(), // 'sole_proprietor', 'partnership', 'company', 'trust'
  financialYearEnd: varchar("financial_year_end", { length: 10 }).notNull(), // 'YYYY-MM-DD' format
  accountingBasis: varchar("accounting_basis", { length: 20 }).notNull(), // 'cash' or 'accrual'
  vatStatus: varchar("vat_status", { length: 20 }).notNull(), // 'registered', 'not_registered', 'exempt'
  vatNumber: varchar("vat_number", { length: 20 }),
  vatPeriod: varchar("vat_period", { length: 20 }), // 'monthly', 'bi_monthly', 'six_monthly'
  organisationId: integer("organisation_id").references(() => organisations.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_tax_profiles_user_id").on(table.userId),
]);

export const insertTaxProfileSchema = createInsertSchema(taxProfiles, {
  legalForm: z.enum(['sole_proprietor', 'partnership', 'company', 'trust']),
  financialYearEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Financial year end must be in YYYY-MM-DD format"),
  accountingBasis: z.enum(['cash', 'accrual']),
  vatStatus: z.enum(['registered', 'not_registered', 'exempt']),
  vatNumber: z.string().optional().nullable(),
  vatPeriod: z.enum(['monthly', 'bi_monthly', 'six_monthly']).optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TaxProfile = typeof taxProfiles.$inferSelect;
export type InsertTaxProfile = z.infer<typeof insertTaxProfileSchema>;

// VAT Returns table - stores finalized VAT201 submissions
export const vatReturns = pgTable("vat_returns", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  periodKey: varchar("period_key", { length: 50 }).notNull(), // e.g., '2025-10' or '2025-Q4'
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  outputVatCents: integer("output_vat_cents").notNull(), // VAT charged on sales
  inputVatCents: integer("input_vat_cents").notNull(), // VAT paid on purchases
  netVatCents: integer("net_vat_cents").notNull(), // outputVat - inputVat
  zeroRatedTotal: integer("zero_rated_total").notNull(), // in cents
  exemptTotal: integer("exempt_total").notNull(), // in cents
  auditData: jsonb("audit_data"), // array of transaction details for audit trail
  organisationId: integer("organisation_id").references(() => organisations.id, { onDelete: 'cascade' }),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_vat_returns_user_id").on(table.userId),
  index("idx_vat_returns_period_key").on(table.periodKey),
  uniqueIndex("idx_vat_returns_unique_period").on(table.userId, table.periodKey),
]);

export const insertVatReturnSchema = createInsertSchema(vatReturns, {
  periodKey: z.string().min(1, "Period key is required"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  submittedAt: z.coerce.date().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type VatReturn = typeof vatReturns.$inferSelect;
export type InsertVatReturn = z.infer<typeof insertVatReturnSchema>;

// IRP6 Provisional Tax Estimates table
export const irp6Estimates = pgTable("irp6_estimates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  yearOfAssessment: integer("year_of_assessment").notNull(), // e.g., 2026
  half: integer("half").notNull(), // 1 or 2
  taxableIncomeCents: integer("taxable_income_cents").notNull(),
  estimatedTaxPayableCents: integer("estimated_tax_payable_cents").notNull(),
  worksheet: jsonb("worksheet"), // calculation breakdown for audit
  organisationId: integer("organisation_id").references(() => organisations.id, { onDelete: 'cascade' }),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_irp6_estimates_user_id").on(table.userId),
  index("idx_irp6_estimates_yoa").on(table.yearOfAssessment),
  uniqueIndex("idx_irp6_estimates_unique_period").on(table.userId, table.yearOfAssessment, table.half),
]);

export const insertIrp6EstimateSchema = createInsertSchema(irp6Estimates, {
  yearOfAssessment: z.number().int().min(2000).max(2100),
  half: z.number().int().min(1).max(2),
  submittedAt: z.coerce.date().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Irp6Estimate = typeof irp6Estimates.$inferSelect;
export type InsertIrp6Estimate = z.infer<typeof insertIrp6EstimateSchema>;
