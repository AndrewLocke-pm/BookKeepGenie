import {
  users,
  categories,
  transactions,
  taxProfiles,
  vatReturns,
  irp6Estimates,
  organisations,
  organisationMembers,
  type User,
  type UpsertUser,
  type Category,
  type InsertCategory,
  type Transaction,
  type InsertTransaction,
  type TransactionWithCategory,
  type TaxProfile,
  type InsertTaxProfile,
  type VatReturn,
  type InsertVatReturn,
  type Irp6Estimate,
  type InsertIrp6Estimate,
} from "@shared/schema";

// ─── Organisation types (query-result shapes, not table types) ───────────────

export type OrganisationWithMeta = {
  id: number;
  name: string;
  vatNumber: string | null;
  country: string;
  createdAt: Date;
  updatedAt: Date;
  userRole: string;
  memberCount: number;
};

export type MemberWithUser = {
  userId: string;
  organisationId: number;
  role: string;
  invitedAt: Date;
  acceptedAt: Date | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Build a WHERE clause that optionally adds an organisationId equality filter. */
function withOrg<T extends { userId: typeof transactions.userId }>(
  userCol: T["userId"],
  userId: string,
  orgCol: typeof transactions.organisationId,
  organisationId?: number | null
) {
  if (organisationId != null) {
    return and(eq(userCol as any, userId), eq(orgCol as any, organisationId));
  }
  return eq(userCol as any, userId);
}

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Category operations
  getAllCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  initializeDefaultCategories(): Promise<void>;

  // Transaction operations
  getAllTransactions(userId: string, organisationId?: number | null): Promise<TransactionWithCategory[]>;
  getTransaction(id: number, userId: string, organisationId?: number | null): Promise<TransactionWithCategory | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, userId: string, updates: Partial<InsertTransaction>, organisationId?: number | null): Promise<Transaction | undefined>;
  deleteTransaction(id: number, userId: string, organisationId?: number | null): Promise<boolean>;

  // Organisation operations
  getOrganisationsByUser(userId: string): Promise<OrganisationWithMeta[]>;
  getOrganisation(id: number, userId: string): Promise<OrganisationWithMeta | undefined>;
  getOrganisationMembers(organisationId: number, userId: string): Promise<MemberWithUser[]>;

  // Tax Profile operations
  getTaxProfile(userId: string, organisationId?: number | null): Promise<TaxProfile | undefined>;
  upsertTaxProfile(profile: InsertTaxProfile): Promise<TaxProfile>;

  // VAT Returns operations
  getVatReturns(userId: string, organisationId?: number | null): Promise<VatReturn[]>;
  getVatReturn(id: number, userId: string, organisationId?: number | null): Promise<VatReturn | undefined>;
  createVatReturn(vatReturn: InsertVatReturn): Promise<VatReturn>;

  // IRP6 Estimates operations
  getIrp6Estimates(userId: string, organisationId?: number | null): Promise<Irp6Estimate[]>;
  getIrp6Estimate(id: number, userId: string, organisationId?: number | null): Promise<Irp6Estimate | undefined>;
  createIrp6Estimate(estimate: InsertIrp6Estimate): Promise<Irp6Estimate>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      const [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    } catch (err: any) {
      // Email already exists under a stale legacy ID (e.g. Replit OIDC → Clerk migration).
      // The old row has no child data (FK would have blocked any writes), so it is safe
      // to delete it and re-insert with the current Clerk ID.
      // drizzle-orm ≥0.44 wraps driver errors in DrizzleQueryError; the original
      // pg/neon error is on err.cause. Support both layouts for forward-compat.
      const cause = err?.cause ?? err;
      if (cause?.code === '23505' && cause?.constraint === 'users_email_unique') {
        await db.delete(users).where(eq(users.email, userData.email!));
        const [user] = await db.insert(users).values(userData).returning();
        return user;
      }
      throw err;
    }
  }

  // Category operations
  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(categoryData: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(categoryData)
      .returning();
    return category;
  }

  async initializeDefaultCategories(): Promise<void> {
    const existingCategories = await this.getAllCategories();
    if (existingCategories.length > 0) {
      return; // Categories already initialized
    }

    const defaultCategories: InsertCategory[] = [
      { name: 'Meals & Entertainment', color: 'hsl(var(--chart-3))', icon: 'utensils' },
      { name: 'Office Supplies', color: 'hsl(var(--chart-1))', icon: 'briefcase' },
      { name: 'Payroll', color: 'hsl(var(--chart-2))', icon: 'users' },
      { name: 'Professional Services', color: 'hsl(var(--chart-4))', icon: 'file-text' },
      { name: 'Travel', color: 'hsl(var(--chart-5))', icon: 'plane' },
      { name: 'Utilities', color: 'hsl(38 92% 50%)', icon: 'zap' },
      { name: 'Other', color: 'hsl(var(--muted-foreground))', icon: 'folder' },
    ];

    for (const category of defaultCategories) {
      await db.insert(categories).values(category).onConflictDoNothing();
    }
  }

  // Transaction operations
  async getAllTransactions(userId: string, organisationId?: number | null): Promise<TransactionWithCategory[]> {
    const condition =
      organisationId != null
        ? and(eq(transactions.userId, userId), eq(transactions.organisationId, organisationId))
        : eq(transactions.userId, userId);

    const results = await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        organisationId: transactions.organisationId,
        date: transactions.date,
        vendor: transactions.vendor,
        description: transactions.description,
        amount: transactions.amount,
        categoryId: transactions.categoryId,
        type: transactions.type,
        kind: transactions.kind,
        direction: transactions.direction,
        affectsProfit: transactions.affectsProfit,
        receiptUrl: transactions.receiptUrl,
        aiProcessed: transactions.aiProcessed,
        aiConfidence: transactions.aiConfidence,
        notes: transactions.notes,
        taxCode: transactions.taxCode,
        taxRate: transactions.taxRate,
        taxInclusive: transactions.taxInclusive,
        supplyType: transactions.supplyType,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
        category: categories,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(condition)
      .orderBy(desc(transactions.date), desc(transactions.createdAt));

    return results as TransactionWithCategory[];
  }

  async getTransaction(id: number, userId: string, organisationId?: number | null): Promise<TransactionWithCategory | undefined> {
    const userAndId = and(eq(transactions.id, id), eq(transactions.userId, userId));
    const condition =
      organisationId != null
        ? and(userAndId, eq(transactions.organisationId, organisationId))
        : userAndId;

    const [result] = await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        organisationId: transactions.organisationId,
        date: transactions.date,
        vendor: transactions.vendor,
        description: transactions.description,
        amount: transactions.amount,
        categoryId: transactions.categoryId,
        type: transactions.type,
        kind: transactions.kind,
        direction: transactions.direction,
        affectsProfit: transactions.affectsProfit,
        receiptUrl: transactions.receiptUrl,
        aiProcessed: transactions.aiProcessed,
        aiConfidence: transactions.aiConfidence,
        notes: transactions.notes,
        taxCode: transactions.taxCode,
        taxRate: transactions.taxRate,
        taxInclusive: transactions.taxInclusive,
        supplyType: transactions.supplyType,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
        category: categories,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(condition);

    return result as TransactionWithCategory | undefined;
  }

  async createTransaction(transactionData: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(transactionData)
      .returning();
    return transaction;
  }

  async updateTransaction(
    id: number,
    userId: string,
    updates: Partial<InsertTransaction>,
    organisationId?: number | null
  ): Promise<Transaction | undefined> {
    const userAndId = and(eq(transactions.id, id), eq(transactions.userId, userId));
    const condition =
      organisationId != null
        ? and(userAndId, eq(transactions.organisationId, organisationId))
        : userAndId;

    const [transaction] = await db
      .update(transactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(condition)
      .returning();
    return transaction;
  }

  async deleteTransaction(id: number, userId: string, organisationId?: number | null): Promise<boolean> {
    const userAndId = and(eq(transactions.id, id), eq(transactions.userId, userId));
    const condition =
      organisationId != null
        ? and(userAndId, eq(transactions.organisationId, organisationId))
        : userAndId;

    const result = await db
      .delete(transactions)
      .where(condition)
      .returning();
    return result.length > 0;
  }

  // Tax Profile operations
  async getTaxProfile(userId: string, organisationId?: number | null): Promise<TaxProfile | undefined> {
    const condition =
      organisationId != null
        ? and(eq(taxProfiles.userId, userId), eq(taxProfiles.organisationId, organisationId))
        : eq(taxProfiles.userId, userId);

    const [profile] = await db
      .select()
      .from(taxProfiles)
      .where(condition);
    return profile;
  }

  async upsertTaxProfile(profileData: InsertTaxProfile): Promise<TaxProfile> {
    const [profile] = await db
      .insert(taxProfiles)
      .values(profileData)
      .onConflictDoUpdate({
        target: taxProfiles.userId,
        set: {
          ...profileData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return profile;
  }

  // VAT Returns operations
  async getVatReturns(userId: string, organisationId?: number | null): Promise<VatReturn[]> {
    const condition =
      organisationId != null
        ? and(eq(vatReturns.userId, userId), eq(vatReturns.organisationId, organisationId))
        : eq(vatReturns.userId, userId);

    return await db
      .select()
      .from(vatReturns)
      .where(condition)
      .orderBy(desc(vatReturns.startDate));
  }

  async getVatReturn(id: number, userId: string, organisationId?: number | null): Promise<VatReturn | undefined> {
    const userAndId = and(eq(vatReturns.id, id), eq(vatReturns.userId, userId));
    const condition =
      organisationId != null
        ? and(userAndId, eq(vatReturns.organisationId, organisationId))
        : userAndId;

    const [vatReturn] = await db
      .select()
      .from(vatReturns)
      .where(condition);
    return vatReturn;
  }

  async createVatReturn(vatReturnData: InsertVatReturn): Promise<VatReturn> {
    const [vatReturn] = await db
      .insert(vatReturns)
      .values(vatReturnData)
      .returning();
    return vatReturn;
  }

  // IRP6 Estimates operations
  async getIrp6Estimates(userId: string, organisationId?: number | null): Promise<Irp6Estimate[]> {
    const condition =
      organisationId != null
        ? and(eq(irp6Estimates.userId, userId), eq(irp6Estimates.organisationId, organisationId))
        : eq(irp6Estimates.userId, userId);

    return await db
      .select()
      .from(irp6Estimates)
      .where(condition)
      .orderBy(desc(irp6Estimates.yearOfAssessment), desc(irp6Estimates.half));
  }

  async getIrp6Estimate(id: number, userId: string, organisationId?: number | null): Promise<Irp6Estimate | undefined> {
    const userAndId = and(eq(irp6Estimates.id, id), eq(irp6Estimates.userId, userId));
    const condition =
      organisationId != null
        ? and(userAndId, eq(irp6Estimates.organisationId, organisationId))
        : userAndId;

    const [estimate] = await db
      .select()
      .from(irp6Estimates)
      .where(condition);
    return estimate;
  }

  async createIrp6Estimate(estimateData: InsertIrp6Estimate): Promise<Irp6Estimate> {
    const [estimate] = await db
      .insert(irp6Estimates)
      .values(estimateData)
      .returning();
    return estimate;
  }

  // Organisation operations
  async getOrganisationsByUser(userId: string): Promise<OrganisationWithMeta[]> {
    const rows = await db
      .select({
        id: organisations.id,
        name: organisations.name,
        vatNumber: organisations.vatNumber,
        country: organisations.country,
        createdAt: organisations.createdAt,
        updatedAt: organisations.updatedAt,
        userRole: organisationMembers.role,
        memberCount: sql<number>`(
          SELECT COUNT(*)::int FROM organisation_members om2
          WHERE om2.organisation_id = ${organisations.id}
        )`,
      })
      .from(organisationMembers)
      .innerJoin(organisations, eq(organisationMembers.organisationId, organisations.id))
      .where(eq(organisationMembers.userId, userId))
      .orderBy(organisations.name);

    return rows.map(r => ({ ...r, memberCount: Number(r.memberCount) }));
  }

  async getOrganisation(id: number, userId: string): Promise<OrganisationWithMeta | undefined> {
    const [row] = await db
      .select({
        id: organisations.id,
        name: organisations.name,
        vatNumber: organisations.vatNumber,
        country: organisations.country,
        createdAt: organisations.createdAt,
        updatedAt: organisations.updatedAt,
        userRole: organisationMembers.role,
        memberCount: sql<number>`(
          SELECT COUNT(*)::int FROM organisation_members om2
          WHERE om2.organisation_id = ${organisations.id}
        )`,
      })
      .from(organisationMembers)
      .innerJoin(organisations, eq(organisationMembers.organisationId, organisations.id))
      .where(and(eq(organisationMembers.userId, userId), eq(organisations.id, id)));

    if (!row) return undefined;
    return { ...row, memberCount: Number(row.memberCount) };
  }

  async getOrganisationMembers(organisationId: number, userId: string): Promise<MemberWithUser[]> {
    // Verify requesting user is a member
    const [membership] = await db
      .select({ userId: organisationMembers.userId })
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.organisationId, organisationId),
          eq(organisationMembers.userId, userId),
        ),
      );

    if (!membership) return [];

    return db
      .select({
        userId: organisationMembers.userId,
        organisationId: organisationMembers.organisationId,
        role: organisationMembers.role,
        invitedAt: organisationMembers.invitedAt,
        acceptedAt: organisationMembers.acceptedAt,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(organisationMembers)
      .leftJoin(users, eq(organisationMembers.userId, users.id))
      .where(eq(organisationMembers.organisationId, organisationId))
      .orderBy(organisationMembers.role, organisationMembers.invitedAt);
  }
}

export const storage = new DatabaseStorage();
