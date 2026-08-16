import { clerkMiddleware, createClerkClient, getAuth } from '@clerk/express';
import type { RequestHandler, Request, Response, NextFunction } from 'express';
import { storage } from './storage';

/** Singleton Clerk backend client — created once at startup. */
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

/** Users already upserted this process lifetime — avoids a Clerk API call on every request. */
const syncedUsers = new Set<string>();

export function setupAuth(app: any) {
  app.use(clerkMiddleware({
    publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  }));
}

export const isAuthenticated: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorised' });
  }

  // Ensure this Clerk user exists in our users table (FK pre-condition for all writes).
  // Only calls the Clerk API once per process per userId — after that the Set acts as a cache.
  if (!syncedUsers.has(userId)) {
    try {
      const clerkUser = await clerk.users.getUser(userId);
      await storage.upsertUser({
        id: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? `${userId}@unknown.invalid`,
        firstName: clerkUser.firstName ?? null,
        lastName: clerkUser.lastName ?? null,
        profileImageUrl: clerkUser.imageUrl ?? null,
      });
      syncedUsers.add(userId);
    } catch (err) {
      // Log but don't block — the FK error below will surface naturally if the upsert failed.
      console.error('[clerkAuth] Failed to sync user to DB:', err);
    }
  }

  next();
};

export function getUserId(req: Request): string {
  const { userId } = getAuth(req);
  if (!userId) throw new Error('No authenticated user');
  return userId;
}
