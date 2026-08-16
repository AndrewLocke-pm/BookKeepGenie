import { db } from '../db';
import { transactions } from '@shared/schema';
import { eq, or, like, sql } from 'drizzle-orm';

/**
 * Backfill script to identify and reclassify existing capital/investment transactions
 * Run this once after adding the new classification fields
 */
async function backfillOwnerFunds() {
  console.log('Starting backfill of owner funds transactions...');
  
  try {
    // Patterns that indicate capital contributions or director loans
    const capitalPatterns = [
      '%capital%',
      '%invest%',
      '%contribution%',
      '%contributed%',
      '%invested%',
      '%investment%',
    ];
    
    const loanPatterns = [
      '%director%loan%',
      '%shareholder%loan%',
      '%loan%business%',
      '%loan%company%',
      '%owner%loan%',
    ];
    
    // Build the WHERE clause
    const capitalConditions = capitalPatterns.map(pattern => 
      like(sql`LOWER(${transactions.description})`, pattern.toLowerCase())
    );
    
    const loanConditions = loanPatterns.map(pattern =>
      like(sql`LOWER(${transactions.description})`, pattern.toLowerCase())
    );
    
    // Find potential capital contributions
    const capitalTransactions = await db
      .select()
      .from(transactions)
      .where(or(...capitalConditions));
    
    console.log(`Found ${capitalTransactions.length} potential capital contribution transactions`);
    
    // Update capital contributions
    for (const transaction of capitalTransactions) {
      await db
        .update(transactions)
        .set({
          kind: 'capital',
          direction: 'inflow',
          affectsProfit: false,
          taxCode: 'out_of_scope',
        })
        .where(eq(transactions.id, transaction.id));
    }
    
    console.log(`Updated ${capitalTransactions.length} capital contribution transactions`);
    
    // Find potential director loans
    const loanTransactions = await db
      .select()
      .from(transactions)
      .where(or(...loanConditions));
    
    console.log(`Found ${loanTransactions.length} potential director loan transactions`);
    
    // Update director loans
    for (const transaction of loanTransactions) {
      await db
        .update(transactions)
        .set({
          kind: 'owner_loan',
          direction: 'inflow',
          affectsProfit: false,
          taxCode: 'out_of_scope',
        })
        .where(eq(transactions.id, transaction.id));
    }
    
    console.log(`Updated ${loanTransactions.length} director loan transactions`);
    
    console.log('Backfill completed successfully!');
    console.log(`Total transactions reclassified: ${capitalTransactions.length + loanTransactions.length}`);
    
  } catch (error) {
    console.error('Error during backfill:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillOwnerFunds()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Backfill failed:', error);
      process.exit(1);
    });
}

export { backfillOwnerFunds };
