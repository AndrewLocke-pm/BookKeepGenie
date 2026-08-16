import { type Transaction } from "@shared/schema";

/**
 * VAT Calculation Result
 */
export interface VatCalcResult {
  outputVatCents: number;    // VAT on sales (output tax)
  inputVatCents: number;      // VAT on purchases (input tax)
  netVatCents: number;        // outputVat - inputVat
  
  // Box 1: Output Tax (VAT on sales)
  standardRatedSuppliesCents: number;     // Standard-rated sales
  zeroRatedSuppliesCents: number;         // Zero-rated exports
  
  // Box 6: Input Tax (VAT on purchases)
  standardRatedAcquisitionsCents: number; // Standard-rated purchases
  capitalGoodsCents: number;              // Capital goods VAT
  
  // Other totals
  exemptSuppliesCents: number;            // Exempt supplies
  outOfScopeCents: number;                // Out of scope
  
  auditRows: VatAuditRow[];
}

export interface VatAuditRow {
  id: number;
  date: string;
  vendor: string;
  description: string | null;
  type: string; // 'income' or 'expense'
  amountCents: number;
  taxCode: string;
  taxRate: number; // in basis points
  taxInclusive: boolean;
  supplyType: string | null;
  vatAmountCents: number;
}

/**
 * Calculate VAT for a set of transactions
 * 
 * @param transactions Array of transactions to calculate VAT for
 * @param options Calculation options
 * @returns VAT calculation results with audit trail
 */
export function vatCalc(
  transactions: Transaction[],
  options: {
    rateBps?: number;          // Default VAT rate in basis points (default: 1500 = 15%)
  } = {}
): VatCalcResult {
  const defaultRateBps = options.rateBps || 1500; // Default 15% VAT

  let outputVatCents = 0;
  let inputVatCents = 0;
  let standardRatedSuppliesCents = 0;
  let zeroRatedSuppliesCents = 0;
  let standardRatedAcquisitionsCents = 0;
  let capitalGoodsCents = 0;
  let exemptSuppliesCents = 0;
  let outOfScopeCents = 0;
  
  const auditRows: VatAuditRow[] = [];
  
  // Filter out owner funds transactions (capital, owner_loan, transfer) and out_of_scope/exempt
  const eligibleTransactions = transactions.filter(txn => {
    const kind = (txn as any).kind; // TypeScript doesn't know about kind yet
    const taxCode = txn.taxCode;
    
    // Exclude owner funds kinds
    if (kind && ['capital', 'owner_loan', 'transfer'].includes(kind)) {
      return false;
    }
    
    // Exclude out_of_scope and exempt from VAT
    if (taxCode && ['exempt', 'out_of_scope'].includes(taxCode)) {
      return false;
    }
    
    return true;
  });

  for (const txn of eligibleTransactions) {
    const amountCents = Math.round(parseFloat(txn.amount) * 100);
    const taxCode = txn.taxCode || 'standard';
    const taxInclusive = txn.taxInclusive ?? true;
    const supplyType = txn.supplyType || null;
    
    // Use transaction-specific tax rate if available, otherwise use default
    const txnRateBps = txn.taxRate || defaultRateBps;
    const rateDecimal = txnRateBps / 10000;
    
    let vatAmountCents = 0;

    // Calculate VAT based on tax code
    if (taxCode === 'standard') {
      if (taxInclusive) {
        // Amount includes VAT: extract VAT using formula: VAT = amount × (rate / (1 + rate))
        vatAmountCents = Math.round(amountCents * (rateDecimal / (1 + rateDecimal)));
      } else {
        // Amount excludes VAT: add VAT using formula: VAT = amount × rate
        vatAmountCents = Math.round(amountCents * rateDecimal);
      }
      
      // Categorize based on transaction type and supply type
      if (txn.type === 'income') {
        // For SARS Box 1a: record net-of-VAT value of supplies
        const netSupplyValue = taxInclusive 
          ? amountCents - vatAmountCents  // Remove VAT from inclusive amount
          : amountCents;                   // Already exclusive
        standardRatedSuppliesCents += netSupplyValue;
        outputVatCents += vatAmountCents;
      } else if (txn.type === 'expense') {
        // Check if this is a capital good (asset purchase)
        if (supplyType === 'capital') {
          capitalGoodsCents += vatAmountCents;
        } else {
          standardRatedAcquisitionsCents += vatAmountCents;
        }
        inputVatCents += vatAmountCents;
      }
    } else if (taxCode === 'zero_rated') {
      vatAmountCents = 0;
      if (txn.type === 'income') {
        // Zero-rated supplies: full amount (already net, no VAT)
        zeroRatedSuppliesCents += amountCents;
      }
    } else if (taxCode === 'exempt') {
      vatAmountCents = 0;
      exemptSuppliesCents += amountCents;
    } else if (txn.type === 'out_of_scope') {
      vatAmountCents = 0;
      outOfScopeCents += amountCents;
    }

    // Add audit row
    auditRows.push({
      id: txn.id,
      date: txn.date.toISOString().split('T')[0],
      vendor: txn.vendor,
      description: txn.description,
      type: txn.type,
      amountCents,
      taxCode,
      taxRate: txnRateBps,
      taxInclusive,
      supplyType,
      vatAmountCents,
    });
  }

  const netVatCents = outputVatCents - inputVatCents;

  return {
    outputVatCents,
    inputVatCents,
    netVatCents,
    standardRatedSuppliesCents,
    zeroRatedSuppliesCents,
    standardRatedAcquisitionsCents,
    capitalGoodsCents,
    exemptSuppliesCents,
    outOfScopeCents,
    auditRows,
  };
}

/**
 * IRP6 Provisional Tax Calculation Result
 */
export interface Irp6CalcResult {
  taxableIncomeCents: number;
  estTaxPayableCents: number;
  worksheet: Irp6Worksheet;
}

export interface Irp6Worksheet {
  yearOfAssessment: number;
  half: number;
  legalForm: string;
  ytdIncomeCents: number;
  ytdExpenseCents: number;
  taxableIncomeCents: number;
  corpRateBps: number;
  
  // Tax calculation breakdown
  basicTaxCents: number;      // Tax before rebates
  primaryRebateCents: number; // Primary rebate (individuals only)
  totalRebatesCents: number;  // Total rebates
  taxAfterRebatesCents: number; // Tax after rebates
  
  // Provisional payment calculation
  estimatedTaxForYear: number; // Estimated total tax for year
  provisionalPaymentDue: number; // Payment due this period
  firstHalfPayment: number;    // Amount paid in first half (for second half calc)
  
  calculatedAt: string;
}

/**
 * Calculate IRP6 Provisional Tax estimate
 * 
 * @param params Calculation parameters
 * @returns Tax estimate with worksheet
 */
export function irp6Calc(params: {
  yoa: number;               // Year of Assessment (e.g., 2026)
  half: number;              // 1 or 2
  legalForm: string;         // 'sole_proprietor', 'partnership', 'company', 'trust'
  ytdIncomeCents: number;    // Year-to-date income in cents
  ytdExpenseCents: number;   // Year-to-date expenses in cents
  firstHalfPaymentCents?: number; // Amount paid in first half (for second half calculation)
  corpRateBps?: number;      // Corporate tax rate in basis points (default: 2700 = 27%)
}): Irp6CalcResult {
  const { yoa, half, legalForm, ytdIncomeCents, ytdExpenseCents } = params;
  const corpRateBps = params.corpRateBps || 2700; // Default 27% for companies
  const rateDecimal = corpRateBps / 10000;
  const firstHalfPaymentCents = params.firstHalfPaymentCents || 0;

  // Calculate taxable income
  const taxableIncomeCents = Math.max(0, ytdIncomeCents - ytdExpenseCents);

  let basicTaxCents = 0;
  let primaryRebateCents = 0;
  let totalRebatesCents = 0;

  // Annualize the taxable income for provisional tax calculation
  // For first half: project full year based on 6 months of data
  // For second half: use actual full year data
  let annualizedTaxableIncomeCents = taxableIncomeCents;
  if (half === 1) {
    // Annualize: assume second half will be same as first half
    annualizedTaxableIncomeCents = taxableIncomeCents * 2;
  }

  // Calculate tax payable based on legal form
  if (legalForm === 'company' || legalForm === 'trust') {
    // Flat corporate tax rate - no rebates
    basicTaxCents = Math.round(annualizedTaxableIncomeCents * rateDecimal);
    primaryRebateCents = 0;
    totalRebatesCents = 0;
  } else {
    // Individual/sole proprietor/partnership tax brackets
    // SARS 2024/2025 tax year (1 March 2024 - 28 February 2025)
    
    // Calculate basic tax using official SARS 2024/25 tax tables
    if (annualizedTaxableIncomeCents <= 23710000) { // R237,100
      basicTaxCents = Math.round(annualizedTaxableIncomeCents * 0.18);
    } else if (annualizedTaxableIncomeCents <= 37050000) { // R370,500
      basicTaxCents = 4267800 + Math.round((annualizedTaxableIncomeCents - 23710000) * 0.26);
    } else if (annualizedTaxableIncomeCents <= 51280000) { // R512,800
      basicTaxCents = 7736200 + Math.round((annualizedTaxableIncomeCents - 37050000) * 0.31);
    } else if (annualizedTaxableIncomeCents <= 67382400) { // R673,824
      basicTaxCents = 12147500 + Math.round((annualizedTaxableIncomeCents - 51280000) * 0.36);
    } else if (annualizedTaxableIncomeCents <= 79395400) { // R793,954
      basicTaxCents = 17984364 + Math.round((annualizedTaxableIncomeCents - 67382400) * 0.39);
    } else if (annualizedTaxableIncomeCents <= 162995400) { // R1,629,954
      basicTaxCents = 22669454 + Math.round((annualizedTaxableIncomeCents - 79395400) * 0.41);
    } else {
      basicTaxCents = 56915864 + Math.round((annualizedTaxableIncomeCents - 162995400) * 0.45);
    }
    
    // Apply SARS rebates for individuals (2024/2025 tax year)
    primaryRebateCents = 1723500; // R17,235 primary rebate for all individuals
    
    // For simplicity, only using primary rebate
    // In reality, secondary (age 65+: R9,444) and tertiary (age 75+: R3,145) rebates also exist
    totalRebatesCents = primaryRebateCents;
  }

  // Calculate tax after rebates
  const taxAfterRebatesCents = Math.max(0, basicTaxCents - totalRebatesCents);

  // Calculate provisional payment based on half
  let estimatedTaxForYear = 0;
  let provisionalPaymentDue = 0;

  if (half === 1) {
    // First provisional payment: 50% of annualized estimated tax
    estimatedTaxForYear = taxAfterRebatesCents;
    provisionalPaymentDue = Math.round(estimatedTaxForYear * 0.5); // 50% due in first half
  } else {
    // Second provisional payment: 100% of estimated annual tax minus first payment
    estimatedTaxForYear = taxAfterRebatesCents;
    provisionalPaymentDue = Math.max(0, estimatedTaxForYear - firstHalfPaymentCents);
  }

  const worksheet: Irp6Worksheet = {
    yearOfAssessment: yoa,
    half,
    legalForm,
    ytdIncomeCents,
    ytdExpenseCents,
    taxableIncomeCents,
    corpRateBps,
    basicTaxCents,
    primaryRebateCents,
    totalRebatesCents,
    taxAfterRebatesCents,
    estimatedTaxForYear,
    provisionalPaymentDue,
    firstHalfPayment: firstHalfPaymentCents,
    calculatedAt: new Date().toISOString(),
  };

  return {
    taxableIncomeCents,
    estTaxPayableCents: provisionalPaymentDue,
    worksheet,
  };
}

/**
 * VAT Period info
 */
export interface VatPeriod {
  periodKey: string;         // e.g., '2025-10' or '2025-Q4'
  startDate: Date;
  endDate: Date;
}

/**
 * Derive VAT periods for a financial year
 * 
 * @param financialYearEnd Financial year end in YYYY-MM-DD format (e.g., '2026-02-28')
 * @param vatPeriod VAT filing frequency ('monthly', 'bi_monthly', 'six_monthly')
 * @returns Array of VAT periods for the financial year
 */
export function deriveVatPeriods(
  financialYearEnd: string,
  vatPeriod: 'monthly' | 'bi_monthly' | 'six_monthly'
): VatPeriod[] {
  const fyeDate = new Date(financialYearEnd);
  const fyeYear = fyeDate.getFullYear();
  const fyeMonth = fyeDate.getMonth(); // 0-indexed

  // Calculate financial year start (one year before end)
  const fyStart = new Date(fyeYear - 1, fyeMonth + 1, 1);
  const fyEnd = new Date(fyeYear, fyeMonth + 1, 0); // Last day of FY

  const periods: VatPeriod[] = [];

  if (vatPeriod === 'monthly') {
    // Generate 12 monthly periods
    for (let i = 0; i < 12; i++) {
      const startDate = new Date(fyStart.getFullYear(), fyStart.getMonth() + i, 1);
      const endDate = new Date(fyStart.getFullYear(), fyStart.getMonth() + i + 1, 0);
      const periodKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
      
      periods.push({ periodKey, startDate, endDate });
    }
  } else if (vatPeriod === 'bi_monthly') {
    // Generate 6 bi-monthly periods
    for (let i = 0; i < 6; i++) {
      const startDate = new Date(fyStart.getFullYear(), fyStart.getMonth() + (i * 2), 1);
      const endDate = new Date(fyStart.getFullYear(), fyStart.getMonth() + (i * 2) + 2, 0);
      const periodKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
      
      periods.push({ periodKey, startDate, endDate });
    }
  } else if (vatPeriod === 'six_monthly') {
    // Generate 2 six-monthly periods
    for (let i = 0; i < 2; i++) {
      const startDate = new Date(fyStart.getFullYear(), fyStart.getMonth() + (i * 6), 1);
      const endDate = new Date(fyStart.getFullYear(), fyStart.getMonth() + (i * 6) + 6, 0);
      const periodKey = `${startDate.getFullYear()}-H${i + 1}`;
      
      periods.push({ periodKey, startDate, endDate });
    }
  }

  return periods;
}

/**
 * Calculate next VAT201 due date
 * 
 * @param vatPeriod VAT filing frequency
 * @param financialYearEnd Financial year end in YYYY-MM-DD format
 * @returns Next VAT201 due date
 */
export function getNextVatDueDate(
  vatPeriod: 'monthly' | 'bi_monthly' | 'six_monthly',
  financialYearEnd: string
): Date {
  const today = new Date();
  const periods = deriveVatPeriods(financialYearEnd, vatPeriod);
  
  // Find the first period that hasn't ended yet or has ended recently
  for (const period of periods) {
    // VAT is typically due on the 25th of the month following the period end
    const dueDate = new Date(period.endDate);
    dueDate.setMonth(dueDate.getMonth() + 1);
    dueDate.setDate(25);
    
    if (dueDate >= today) {
      return dueDate;
    }
  }
  
  // If all periods in current FY have passed, return the first period of next FY
  const nextFyEnd = new Date(financialYearEnd);
  nextFyEnd.setFullYear(nextFyEnd.getFullYear() + 1);
  const nextPeriods = deriveVatPeriods(nextFyEnd.toISOString().split('T')[0], vatPeriod);
  const firstDueDate = new Date(nextPeriods[0].endDate);
  firstDueDate.setMonth(firstDueDate.getMonth() + 1);
  firstDueDate.setDate(25);
  
  return firstDueDate;
}

/**
 * Calculate next IRP6 due date
 * 
 * @param financialYearEnd Financial year end in YYYY-MM-DD format
 * @returns Next IRP6 due date
 */
export function getNextIrp6DueDate(financialYearEnd: string): Date {
  const today = new Date();
  const fyeDate = new Date(financialYearEnd);
  const fyeYear = fyeDate.getFullYear();
  const fyeMonth = fyeDate.getMonth();
  
  // First provisional payment: 6 months after start of year
  const firstPaymentDate = new Date(fyeYear - 1, fyeMonth + 7, 0); // Last day of 6th month
  
  // Second provisional payment: End of financial year
  const secondPaymentDate = new Date(fyeYear, fyeMonth + 1, 0); // Last day of FY
  
  if (today < firstPaymentDate) {
    return firstPaymentDate;
  } else if (today < secondPaymentDate) {
    return secondPaymentDate;
  } else {
    // Return first payment of next year
    const nextYearFirstPayment = new Date(fyeYear, fyeMonth + 7, 0);
    return nextYearFirstPayment;
  }
}
