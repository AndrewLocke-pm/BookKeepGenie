/**
 * Rules-first transaction classification
 * 
 * This module provides regex-based pattern matching for transaction classification.
 * Rules are checked before falling back to LLM classification.
 */

export interface RuleMatch {
  kind: 'capital' | 'owner_loan' | 'transfer' | 'tax' | 'income' | 'expense';
  direction: 'inflow' | 'outflow';
  affectsProfit: boolean;
  taxCode: 'standard' | 'zero_rated' | 'exempt' | 'out_of_scope' | 'unknown';
  confidence: number;
  matchedRule: string;
}

/**
 * Regex patterns for transaction classification
 */
export const patterns = {
  // Owner funds: capital contributions, investments
  ownerFunds: /(invest(ed|ment)|capital|contribut(ed|ion)|paid in|put in|funded|equity injection|capital injection)/i,
  
  // Owner loans: director's loans, shareholder loans
  ownerLoan: /((director|shareholder).*\bloan\b)|(\bloan\b.*(to|into).*(business|company))|((director|shareholder).*(lent|loaned|advanced))/i,
  
  // Transfers: moving money between accounts
  transfer: /\btransfer\b|\bmove(d)? funds?\b|\btransfer(red)? (to|from|between)\b/i,
  
  // Tax payments: SARS, VAT, PAYE, etc.
  taxPayment: /\b(SARS|tax|VAT|PAYE|IRP6|EMP201|EMP501|provisional tax|income tax).*(payment|paid|settlement|remittance)\b/i,
  
  // Negative patterns that should NOT be classified as owner funds
  // e.g., "invest in advertising" or "capital equipment"
  notOwnerFunds: /\b(invest(ed|ing)? in|capital (goods|equipment|asset|expenditure))\b/i,
};

/**
 * Apply rule-based classification to transaction text
 * 
 * @param input - Transaction text, vendor, and context
 * @returns RuleMatch if a rule matches, null otherwise
 */
export function applyRules(input: {
  text: string;
  vendor?: string;
  currentUserName?: string;
}): RuleMatch | null {
  const combinedText = `${input.text || ''} ${input.vendor || ''}`.toLowerCase();
  
  // Check negative patterns first - these should NOT be classified as owner funds
  if (patterns.notOwnerFunds.test(combinedText)) {
    // This looks like business expense, not owner funds
    // Return null to let LLM handle it
    return null;
  }
  
  // Check for director/owner loan patterns
  if (patterns.ownerLoan.test(combinedText)) {
    return {
      kind: 'owner_loan',
      direction: 'inflow',
      affectsProfit: false,
      taxCode: 'out_of_scope',
      confidence: 0.95,
      matchedRule: 'ownerLoan',
    };
  }
  
  // Check for capital contribution patterns
  if (patterns.ownerFunds.test(combinedText)) {
    // Additional validation: if the vendor/text mentions the current user name,
    // it's more likely to be owner funds
    const mentionsUser = input.currentUserName && 
      combinedText.includes(input.currentUserName.toLowerCase());
    
    return {
      kind: 'capital',
      direction: 'inflow',
      affectsProfit: false,
      taxCode: 'out_of_scope',
      confidence: mentionsUser ? 0.95 : 0.85,
      matchedRule: 'ownerFunds',
    };
  }
  
  // Check for transfer patterns
  if (patterns.transfer.test(combinedText)) {
    return {
      kind: 'transfer',
      direction: 'outflow', // Default, can be overridden by amount sign
      affectsProfit: false,
      taxCode: 'out_of_scope',
      confidence: 0.90,
      matchedRule: 'transfer',
    };
  }
  
  // Check for tax payment patterns
  if (patterns.taxPayment.test(combinedText)) {
    return {
      kind: 'tax',
      direction: 'outflow',
      affectsProfit: false,
      taxCode: 'out_of_scope',
      confidence: 0.90,
      matchedRule: 'taxPayment',
    };
  }
  
  // No rule matched
  return null;
}

/**
 * Test a specific pattern against text (for debugging)
 */
export function testPattern(patternName: keyof typeof patterns, text: string): boolean {
  const pattern = patterns[patternName];
  return pattern.test(text);
}
