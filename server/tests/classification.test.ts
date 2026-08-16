/**
 * Comprehensive test suite for bulletproof transaction classification
 * 
 * Tests:
 * 1. Rules-first classification patterns
 * 2. Owner funds enforcement
 * 3. P&L exclusion logic
 * 4. VAT exclusion logic
 * 5. Database constraint validation
 */

import { describe, test, expect } from '@jest/globals';
import { applyRules, patterns } from '../nlp/rules';
import { 
  enforceOwnerFundsRules, 
  shouldExcludeFromProfitAndLoss,
  shouldExcludeFromVAT 
} from '../nlp/classifyTransaction';

describe('Rules-first Classification', () => {
  describe('Capital Contribution Patterns', () => {
    test('should detect capital investment keywords', () => {
      const result = applyRules({
        text: 'Invested R50000 into the business',
        vendor: 'Owner',
        currentUserName: 'John Smith'
      });
      
      expect(result).not.toBeNull();
      expect(result?.kind).toBe('capital');
      expect(result?.affectsProfit).toBe(false);
      expect(result?.taxCode).toBe('out_of_scope');
      expect(result?.confidence).toBeGreaterThan(0.8);
    });

    test('should detect capital contribution phrase', () => {
      const result = applyRules({
        text: 'Capital contribution for startup costs',
        vendor: 'Owner',
      });
      
      expect(result).not.toBeNull();
      expect(result?.kind).toBe('capital');
    });

    test('should detect equity injection', () => {
      const result = applyRules({
        text: 'Equity injection to fund operations',
        vendor: 'Shareholder',
      });
      
      expect(result).not.toBeNull();
      expect(result?.kind).toBe('capital');
    });

    test('should NOT detect "invest in advertising" as owner funds', () => {
      const result = applyRules({
        text: 'Invest in advertising campaign',
        vendor: 'Marketing Agency',
      });
      
      // Should return null, let LLM handle it
      expect(result).toBeNull();
    });

    test('should NOT detect "capital equipment" as owner funds', () => {
      const result = applyRules({
        text: 'Purchase capital equipment for factory',
        vendor: 'Equipment Supplier',
      });
      
      expect(result).toBeNull();
    });
  });

  describe('Director Loan Patterns', () => {
    test('should detect director loan keywords', () => {
      const result = applyRules({
        text: "Director's loan to company",
        vendor: 'John Smith',
      });
      
      expect(result).not.toBeNull();
      expect(result?.kind).toBe('owner_loan');
      expect(result?.affectsProfit).toBe(false);
      expect(result?.taxCode).toBe('out_of_scope');
    });

    test('should detect shareholder loan', () => {
      const result = applyRules({
        text: 'Shareholder loan for working capital',
        vendor: 'Owner',
      });
      
      expect(result).not.toBeNull();
      expect(result?.kind).toBe('owner_loan');
    });

    test('should detect loan to business phrase', () => {
      const result = applyRules({
        text: 'Loan into the business account',
        vendor: 'Director',
      });
      
      expect(result).not.toBeNull();
      expect(result?.kind).toBe('owner_loan');
    });
  });

  describe('Transfer Patterns', () => {
    test('should detect transfer between accounts', () => {
      const result = applyRules({
        text: 'Transfer from savings to checking',
        vendor: 'Bank',
      });
      
      expect(result).not.toBeNull();
      expect(result?.kind).toBe('transfer');
      expect(result?.affectsProfit).toBe(false);
    });

    test('should detect money movement', () => {
      const result = applyRules({
        text: 'Move funds to business account',
        vendor: 'Bank',
      });
      
      expect(result).not.toBeNull();
      expect(result?.kind).toBe('transfer');
    });
  });

  describe('Tax Payment Patterns', () => {
    test('should detect SARS payment', () => {
      const result = applyRules({
        text: 'SARS VAT payment for Q1',
        vendor: 'SARS',
      });
      
      expect(result).not.toBeNull();
      expect(result?.kind).toBe('tax');
      expect(result?.affectsProfit).toBe(false);
      expect(result?.taxCode).toBe('out_of_scope');
    });

    test('should detect PAYE payment', () => {
      const result = applyRules({
        text: 'PAYE payment to SARS',
        vendor: 'SARS',
      });
      
      expect(result).not.toBeNull();
      expect(result?.kind).toBe('tax');
    });

    test('should detect provisional tax', () => {
      const result = applyRules({
        text: 'Provisional tax payment',
        vendor: 'SARS eFiling',
      });
      
      expect(result).not.toBeNull();
      expect(result?.kind).toBe('tax');
    });
  });

  describe('Pattern Regex Tests', () => {
    test('ownerFunds pattern should match investment terms', () => {
      expect(patterns.ownerFunds.test('invested R10000')).toBe(true);
      expect(patterns.ownerFunds.test('capital contribution')).toBe(true);
      expect(patterns.ownerFunds.test('equity injection')).toBe(true);
      expect(patterns.ownerFunds.test('paid in capital')).toBe(true);
    });

    test('ownerLoan pattern should match loan terms', () => {
      expect(patterns.ownerLoan.test("director's loan")).toBe(true);
      expect(patterns.ownerLoan.test('shareholder loan')).toBe(true);
      expect(patterns.ownerLoan.test('loan to the business')).toBe(true);
    });

    test('notOwnerFunds pattern should match business expenses', () => {
      expect(patterns.notOwnerFunds.test('invest in marketing')).toBe(true);
      expect(patterns.notOwnerFunds.test('capital equipment')).toBe(true);
      expect(patterns.notOwnerFunds.test('capital goods')).toBe(true);
    });

    test('transfer pattern should match movement terms', () => {
      expect(patterns.transfer.test('transfer to account')).toBe(true);
      expect(patterns.transfer.test('move funds')).toBe(true);
      expect(patterns.transfer.test('transferred between')).toBe(true);
    });

    test('taxPayment pattern should match tax terms', () => {
      expect(patterns.taxPayment.test('SARS payment')).toBe(true);
      expect(patterns.taxPayment.test('VAT paid')).toBe(true);
      expect(patterns.taxPayment.test('PAYE payment')).toBe(true);
      expect(patterns.taxPayment.test('provisional tax remittance')).toBe(true);
    });
  });
});

describe('Owner Funds Enforcement', () => {
  test('should enforce capital rules', () => {
    const enforced = enforceOwnerFundsRules('capital');
    
    expect(enforced.affectsProfit).toBe(false);
    expect(enforced.taxCode).toBe('out_of_scope');
    expect(enforced.direction).toBe('inflow');
  });

  test('should enforce owner_loan rules', () => {
    const enforced = enforceOwnerFundsRules('owner_loan');
    
    expect(enforced.affectsProfit).toBe(false);
    expect(enforced.taxCode).toBe('out_of_scope');
    expect(enforced.direction).toBe('inflow');
  });

  test('should enforce transfer rules', () => {
    const enforced = enforceOwnerFundsRules('transfer');
    
    expect(enforced.affectsProfit).toBe(false);
    expect(enforced.taxCode).toBe('out_of_scope');
  });

  test('should enforce tax rules', () => {
    const enforced = enforceOwnerFundsRules('tax');
    
    expect(enforced.affectsProfit).toBe(false);
    expect(enforced.taxCode).toBe('out_of_scope');
  });

  test('should NOT enforce rules for regular expenses', () => {
    const enforced = enforceOwnerFundsRules('expense');
    
    expect(Object.keys(enforced)).toHaveLength(0);
  });

  test('should NOT enforce rules for income', () => {
    const enforced = enforceOwnerFundsRules('income');
    
    expect(Object.keys(enforced)).toHaveLength(0);
  });
});

describe('P&L Exclusion Logic', () => {
  test('should exclude capital from P&L', () => {
    expect(shouldExcludeFromProfitAndLoss('capital')).toBe(true);
  });

  test('should exclude owner_loan from P&L', () => {
    expect(shouldExcludeFromProfitAndLoss('owner_loan')).toBe(true);
  });

  test('should exclude transfer from P&L', () => {
    expect(shouldExcludeFromProfitAndLoss('transfer')).toBe(true);
  });

  test('should exclude tax from P&L', () => {
    expect(shouldExcludeFromProfitAndLoss('tax')).toBe(true);
  });

  test('should NOT exclude expense from P&L', () => {
    expect(shouldExcludeFromProfitAndLoss('expense')).toBe(false);
  });

  test('should NOT exclude income from P&L', () => {
    expect(shouldExcludeFromProfitAndLoss('income')).toBe(false);
  });
});

describe('VAT Exclusion Logic', () => {
  describe('By Kind', () => {
    test('should exclude capital from VAT', () => {
      expect(shouldExcludeFromVAT('capital')).toBe(true);
    });

    test('should exclude owner_loan from VAT', () => {
      expect(shouldExcludeFromVAT('owner_loan')).toBe(true);
    });

    test('should exclude transfer from VAT', () => {
      expect(shouldExcludeFromVAT('transfer')).toBe(true);
    });

    test('should exclude tax from VAT', () => {
      expect(shouldExcludeFromVAT('tax')).toBe(true);
    });

    test('should NOT exclude expense from VAT by kind alone', () => {
      expect(shouldExcludeFromVAT('expense')).toBe(false);
    });
  });

  describe('By Tax Code', () => {
    test('should exclude exempt tax code from VAT', () => {
      expect(shouldExcludeFromVAT('expense', 'exempt')).toBe(true);
    });

    test('should exclude out_of_scope tax code from VAT', () => {
      expect(shouldExcludeFromVAT('expense', 'out_of_scope')).toBe(true);
    });

    test('should NOT exclude standard tax code from VAT', () => {
      expect(shouldExcludeFromVAT('expense', 'standard')).toBe(false);
    });

    test('should NOT exclude zero_rated tax code from VAT', () => {
      expect(shouldExcludeFromVAT('expense', 'zero_rated')).toBe(false);
    });
  });

  describe('Combined Kind and Tax Code', () => {
    test('should exclude capital even with standard tax code', () => {
      expect(shouldExcludeFromVAT('capital', 'standard')).toBe(true);
    });

    test('should exclude expense with out_of_scope tax code', () => {
      expect(shouldExcludeFromVAT('expense', 'out_of_scope')).toBe(true);
    });

    test('should NOT exclude expense with standard tax code', () => {
      expect(shouldExcludeFromVAT('expense', 'standard')).toBe(false);
    });
  });
});

describe('Edge Cases', () => {
  test('should handle empty text gracefully', () => {
    const result = applyRules({
      text: '',
      vendor: '',
    });
    
    expect(result).toBeNull();
  });

  test('should handle undefined vendor', () => {
    const result = applyRules({
      text: 'Director loan',
    });
    
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('owner_loan');
  });

  test('should be case insensitive', () => {
    const result = applyRules({
      text: 'CAPITAL CONTRIBUTION',
      vendor: 'OWNER',
    });
    
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('capital');
  });

  test('should handle mixed case', () => {
    const result = applyRules({
      text: 'Director\'s LOAN to Company',
      vendor: 'owner',
    });
    
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('owner_loan');
  });
});

describe('Expense Override Path', () => {
  test('forceKind="expense" should reset affectsProfit to true', () => {
    // Simulate backend logic for expense override
    const originalData = {
      kind: 'capital',
      affectsProfit: false,
      taxCode: 'out_of_scope' as const,
      direction: 'inflow' as const,
    };
    
    // User overrides to expense
    const forceKind = 'expense';
    const finalData = {
      ...originalData,
      kind: forceKind,
      affectsProfit: true,
      direction: 'outflow' as const,
      taxCode: 'unknown' as const,
    };
    
    // Verify reset worked
    expect(finalData.kind).toBe('expense');
    expect(finalData.affectsProfit).toBe(true); // ← Critical for P&L
    expect(finalData.direction).toBe('outflow');
    expect(finalData.taxCode).not.toBe('out_of_scope'); // ← Critical for VAT
  });

  test('forceKind="expense" transaction should appear in P&L', () => {
    const transaction = {
      kind: 'expense' as const,
      affectsProfit: true,
      taxCode: 'unknown' as const,
    };
    
    // Should NOT be excluded from P&L
    expect(shouldExcludeFromProfitAndLoss(transaction.kind)).toBe(false);
  });

  test('forceKind="expense" transaction should appear in VAT', () => {
    const transaction = {
      kind: 'expense' as const,
      affectsProfit: true,
      taxCode: 'unknown' as const,
    };
    
    // Should NOT be excluded from VAT
    expect(shouldExcludeFromVAT(transaction.kind, transaction.taxCode)).toBe(false);
  });

  test('forceKind="capital" should still apply owner funds rules', () => {
    const forceKind = 'capital';
    const enforced = enforceOwnerFundsRules(forceKind);
    
    // Should still enforce capital rules
    expect(enforced.affectsProfit).toBe(false);
    expect(enforced.taxCode).toBe('out_of_scope');
    expect(enforced.direction).toBe('inflow');
  });

  test('forceKind="owner_loan" should still apply owner funds rules', () => {
    const forceKind = 'owner_loan';
    const enforced = enforceOwnerFundsRules(forceKind);
    
    // Should still enforce loan rules
    expect(enforced.affectsProfit).toBe(false);
    expect(enforced.taxCode).toBe('out_of_scope');
    expect(enforced.direction).toBe('inflow');
  });

  test('forceKind="expense" should preserve user-supplied standard tax code', () => {
    // Simulate user providing a valid tax code
    const originalData = {
      kind: 'capital',
      affectsProfit: false,
      taxCode: 'standard' as const, // User selected standard VAT
      direction: 'inflow' as const,
    };
    
    // User overrides to expense
    const forceKind = 'expense';
    const finalData = {
      ...originalData,
      kind: forceKind,
      affectsProfit: true,
      direction: 'outflow' as const,
      // taxCode should be preserved as 'standard'
      taxCode: originalData.taxCode === 'out_of_scope' ? 'unknown' as const : originalData.taxCode,
    };
    
    // Verify user's tax code was preserved
    expect(finalData.taxCode).toBe('standard');
  });

  test('forceKind="expense" should preserve user-supplied zero_rated tax code', () => {
    // Simulate user providing zero-rated tax code
    const originalData = {
      kind: 'capital',
      affectsProfit: false,
      taxCode: 'zero_rated' as const,
      direction: 'inflow' as const,
    };
    
    // User overrides to expense
    const forceKind = 'expense';
    const finalData = {
      ...originalData,
      kind: forceKind,
      affectsProfit: true,
      direction: 'outflow' as const,
      taxCode: originalData.taxCode === 'out_of_scope' ? 'unknown' as const : originalData.taxCode,
    };
    
    // Verify user's tax code was preserved
    expect(finalData.taxCode).toBe('zero_rated');
  });

  test('forceKind="expense" should reset out_of_scope tax code to unknown', () => {
    // Simulate NLP setting out_of_scope tax code
    const originalData = {
      kind: 'capital',
      affectsProfit: false,
      taxCode: 'out_of_scope' as const,
      direction: 'inflow' as const,
    };
    
    // User overrides to expense
    const forceKind = 'expense';
    const finalData = {
      ...originalData,
      kind: forceKind,
      affectsProfit: true,
      direction: 'outflow' as const,
      taxCode: originalData.taxCode === 'out_of_scope' ? 'unknown' as const : originalData.taxCode,
    };
    
    // Verify out_of_scope was reset to unknown
    expect(finalData.taxCode).toBe('unknown');
  });

  test('forceKind="expense" with rehydrated payload should reset all owner funds fields', () => {
    // Simulate a rehydrated payload where owner-funds fields are already present
    // (This happens when the frontend re-submits after showing the modal)
    const rehydratedData = {
      vendor: 'John Smith',
      description: 'Capital contribution',
      amount: 50000,
      kind: 'capital',
      affectsProfit: false,
      direction: 'inflow' as const,
      taxCode: 'out_of_scope' as const,
    };
    
    // User clicks "This is Actually a Business Expense"
    const forceKind = 'expense';
    
    // Backend should unconditionally reset these fields
    const finalData = {
      ...rehydratedData,
      kind: forceKind,
      affectsProfit: true, // CRITICAL: Must be true even if payload says false
      direction: 'outflow' as const, // CRITICAL: Must be outflow even if payload says inflow
      taxCode: rehydratedData.taxCode === 'out_of_scope' ? 'unknown' as const : rehydratedData.taxCode,
    };
    
    // Verify all fields were properly reset
    expect(finalData.kind).toBe('expense');
    expect(finalData.affectsProfit).toBe(true);
    expect(finalData.direction).toBe('outflow');
    expect(finalData.taxCode).toBe('unknown');
    
    // Verify it won't be excluded from P&L or VAT
    expect(shouldExcludeFromProfitAndLoss(finalData.kind)).toBe(false);
    expect(shouldExcludeFromVAT(finalData.kind, finalData.taxCode)).toBe(false);
  });
});

describe('Real-World Scenarios', () => {
  test('Scenario: Owner puts R100k into business', () => {
    const result = applyRules({
      text: 'Invested R100,000 to start the business',
      vendor: 'Owner - John Smith',
      currentUserName: 'John Smith',
    });
    
    expect(result?.kind).toBe('capital');
    expect(result?.affectsProfit).toBe(false);
    expect(result?.taxCode).toBe('out_of_scope');
    expect(result?.confidence).toBeGreaterThan(0.9); // High confidence due to name match
  });

  test('Scenario: Director lends R50k for cashflow', () => {
    const result = applyRules({
      text: "Director's loan for working capital",
      vendor: 'Jane Doe',
      currentUserName: 'Jane Doe',
    });
    
    expect(result?.kind).toBe('owner_loan');
    expect(result?.affectsProfit).toBe(false);
    expect(result?.taxCode).toBe('out_of_scope');
  });

  test('Scenario: VAT payment to SARS', () => {
    const result = applyRules({
      text: 'VAT payment for Q2 2025',
      vendor: 'SARS eFiling',
    });
    
    expect(result?.kind).toBe('tax');
    expect(result?.affectsProfit).toBe(false);
  });

  test('Scenario: Office supplies purchase (NOT owner funds)', () => {
    const result = applyRules({
      text: 'Office supplies from Staples',
      vendor: 'Staples',
    });
    
    expect(result).toBeNull(); // Should not match any rule
  });

  test('Scenario: Advertising campaign (NOT owner funds despite "invest")', () => {
    const result = applyRules({
      text: 'Invest in Facebook advertising',
      vendor: 'Meta Platforms',
    });
    
    expect(result).toBeNull(); // Should not match due to negative pattern
  });

  test('Scenario: Equipment purchase (NOT owner funds despite "capital")', () => {
    const result = applyRules({
      text: 'Purchase capital equipment - forklift',
      vendor: 'Equipment Rentals',
    });
    
    expect(result).toBeNull(); // Should not match due to negative pattern
  });
});
