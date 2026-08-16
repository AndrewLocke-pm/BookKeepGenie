/**
 * Bulletproof transaction classification
 * 
 * Uses rules-first approach with LLM fallback:
 * 1. Check regex rules for common patterns
 * 2. If no rule matches, use OpenAI with strict JSON schema
 * 3. Enforce server-side guardrails regardless of classification source
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { applyRules, type RuleMatch } from './rules';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type TransactionKind = 'income' | 'expense' | 'capital' | 'owner_loan' | 'transfer' | 'tax';
export type TransactionDirection = 'inflow' | 'outflow';
export type TaxCode = 'standard' | 'zero_rated' | 'exempt' | 'out_of_scope' | 'unknown';

export interface ClassificationInput {
  text: string;
  vendor?: string;
  currentUserName: string;
}

export interface ClassificationResult {
  kind: TransactionKind;
  direction: TransactionDirection;
  affectsProfit: boolean;
  taxCode: TaxCode;
  confidence: number;
  reason?: string;
  source?: 'rules' | 'llm' | 'fallback';
  matchedRule?: string;
}

/**
 * Zod schema for validating LLM responses
 */
const llmClassificationSchema = z.object({
  kind: z.enum(['income', 'expense', 'capital', 'owner_loan', 'transfer', 'tax']),
  direction: z.enum(['inflow', 'outflow']),
  affects_profit: z.boolean(),
  taxCode: z.enum(['standard', 'zero_rated', 'exempt', 'out_of_scope', 'unknown']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

/**
 * Call OpenAI for classification with strict JSON schema
 */
async function classifyWithLLM(input: ClassificationInput): Promise<ClassificationResult | null> {
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), 8000); // 8 second timeout
  });
  
  const classifyPromise = async (): Promise<ClassificationResult | null> => {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0, // Deterministic responses
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a South African bookkeeping assistant. Classify transactions into these categories:

CRITICAL RULES:
- "capital" = Money the owner puts in (not expected back). Sets affects_profit=false, taxCode=out_of_scope
- "owner_loan" = Director's loan to company (to be repaid). Sets affects_profit=false, taxCode=out_of_scope
- "transfer" = Moving money between accounts. Sets affects_profit=false, taxCode=out_of_scope
- "tax" = Tax payments (SARS, VAT, PAYE). Sets affects_profit=false, taxCode=out_of_scope
- "income" = Business revenue. Sets affects_profit=true
- "expense" = Business operating costs. Sets affects_profit=true

IMPORTANT: "invest in advertising" or "capital equipment" are EXPENSES, not owner capital!

Respond with valid JSON matching this schema:
{
  "kind": "income" | "expense" | "capital" | "owner_loan" | "transfer" | "tax",
  "direction": "inflow" | "outflow",
  "affects_profit": boolean,
  "taxCode": "standard" | "zero_rated" | "exempt" | "out_of_scope" | "unknown",
  "confidence": number (0.0-1.0),
  "reasoning": "brief explanation"
}`,
          },
          {
            role: 'user',
            content: `Classify this transaction:
Vendor: ${input.vendor || 'Unknown'}
Description: ${input.text}
Current business owner: ${input.currentUserName}`,
          },
        ],
      });
      
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        console.error('[LLM] No content in response');
        return null;
      }
      
      // Parse and validate with Zod
      const parsed = JSON.parse(content);
      const validated = llmClassificationSchema.parse(parsed);
      
      return {
        kind: validated.kind,
        direction: validated.direction,
        affectsProfit: validated.affects_profit,
        taxCode: validated.taxCode,
        confidence: validated.confidence,
        reason: validated.reasoning || 'LLM classification',
        source: 'llm',
      };
    } catch (error: any) {
      console.error('[LLM] Classification error:', error.message);
      return null;
    }
  };
  
  // Race between LLM call and timeout
  return Promise.race([classifyPromise(), timeoutPromise]);
}

/**
 * Main classification function: rules-first with LLM fallback
 */
export async function classifyFromNLP(input: ClassificationInput): Promise<ClassificationResult> {
  // Step 1: Try rules-based classification
  const ruleMatch = applyRules({
    text: input.text,
    vendor: input.vendor,
    currentUserName: input.currentUserName,
  });
  
  if (ruleMatch) {
    console.log('[Classifier] Rules matched:', ruleMatch.matchedRule);
    return {
      ...ruleMatch,
      reason: `Rule matched: ${ruleMatch.matchedRule}`,
      source: 'rules',
    };
  }
  
  // Step 2: Try LLM classification
  console.log('[Classifier] No rule match, using LLM...');
  const llmResult = await classifyWithLLM(input);
  
  if (llmResult) {
    // Log if LLM disagrees with what rules would have said
    // (This is our telemetry for rule improvement)
    const potentialRuleMatch = applyRules({
      text: input.text,
      vendor: input.vendor,
      currentUserName: input.currentUserName,
    });
    
    if (potentialRuleMatch && potentialRuleMatch.kind !== llmResult.kind) {
      console.warn('[Telemetry] Rules vs LLM disagreement:', {
        text: input.text.substring(0, 100),
        rulesKind: potentialRuleMatch.kind,
        llmKind: llmResult.kind,
        rulesConfidence: potentialRuleMatch.confidence,
        llmConfidence: llmResult.confidence,
      });
    }
    
    return llmResult;
  }
  
  // Step 3: Fallback classification (LLM timeout or error)
  console.warn('[Classifier] LLM failed, using fallback classification');
  
  // Infer from amount sign if available
  const text = input.text.toLowerCase();
  const isIncome = text.includes('income') || text.includes('revenue') || text.includes('sale');
  
  return {
    kind: isIncome ? 'income' : 'expense',
    direction: isIncome ? 'inflow' : 'outflow',
    affectsProfit: true,
    taxCode: 'unknown',
    confidence: 0.3,
    reason: 'Fallback classification (LLM unavailable)',
    source: 'fallback',
  };
}

/**
 * Synchronous version for when we need immediate results
 */
export function classifyFromNLPSync(input: ClassificationInput): ClassificationResult {
  // Only use rules (no LLM)
  const ruleMatch = applyRules({
    text: input.text,
    vendor: input.vendor,
    currentUserName: input.currentUserName,
  });
  
  if (ruleMatch) {
    return {
      ...ruleMatch,
      reason: `Rule matched: ${ruleMatch.matchedRule}`,
      source: 'rules',
    };
  }
  
  // Fallback
  const text = input.text.toLowerCase();
  const isIncome = text.includes('income') || text.includes('revenue') || text.includes('sale');
  
  return {
    kind: isIncome ? 'income' : 'expense',
    direction: isIncome ? 'inflow' : 'outflow',
    affectsProfit: true,
    taxCode: 'unknown',
    confidence: 0.3,
    reason: 'Fallback classification (rules-only mode)',
    source: 'fallback',
  };
}

/**
 * Enforce business rules for balance-sheet transactions
 * These fields are locked regardless of classification source
 */
export function enforceOwnerFundsRules(kind: TransactionKind): Partial<ClassificationResult> {
  if (kind === 'capital' || kind === 'owner_loan' || kind === 'transfer' || kind === 'tax') {
    return {
      affectsProfit: false,
      taxCode: 'out_of_scope',
      direction: 'inflow', // Default for owner funds, can be overridden
    };
  }
  
  return {};
}

/**
 * Check if a transaction kind should be excluded from P&L
 */
export function shouldExcludeFromProfitAndLoss(kind: TransactionKind): boolean {
  return ['capital', 'owner_loan', 'transfer', 'tax'].includes(kind);
}

/**
 * Check if a transaction should be excluded from VAT calculations
 */
export function shouldExcludeFromVAT(kind: TransactionKind, taxCode?: TaxCode): boolean {
  // Exclude by kind
  if (['capital', 'owner_loan', 'transfer', 'tax'].includes(kind)) {
    return true;
  }
  
  // Exclude by tax code
  if (taxCode && ['exempt', 'out_of_scope'].includes(taxCode)) {
    return true;
  }
  
  return false;
}
