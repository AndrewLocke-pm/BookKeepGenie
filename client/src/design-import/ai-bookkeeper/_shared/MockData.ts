export const organisation = {
  name: "Acme Plumbing (Pty) Ltd",
  vatNumber: "4930293846",
  regNumber: "2021/123456/07",
  currency: "ZAR",
  financialYearEnd: "28 Feb"
};

export const user = {
  name: "John Owner",
  email: "john@business.co.za",
  role: "Owner",
  initials: "JO"
};

export const dashboardMetrics = {
  revenue: 132000,
  expenses: 73097,
  netProfit: 58903,
  transactionCount: 25
};

export const sixMonthProfitTrend = [
  { month: "Nov", profit: 28400 },
  { month: "Dec", profit: 34200 },
  { month: "Jan", profit: 41500 },
  { month: "Feb", profit: 38900 },
  { month: "Mar", profit: 51200 },
  { month: "Apr", profit: 58903 }
];

export const vatSummary = {
  outputVat: 17217,
  inputVat: 8876,
  netVat: 8341,
  period: "Apr 2024",
  dueDate: "25 May 2024"
};

export const irp6 = {
  taxYear: "2024",
  estimatedAnnualIncome: 687000,
  estimatedTax: 148500,
  taxPaid: 0,
  provisionalAmount: 37800
};

export const categories = [
  { id: "c1", name: "Capital", icon: "arrow-down", color: "amber", type: "equity", system: true, usageCount: 1, totalAmount: 50000, vatDefault: false },
  { id: "c2", name: "Owner Loan", icon: "banknote", color: "amber", type: "liability", system: true, usageCount: 1, totalAmount: 25000, vatDefault: false },
  { id: "c3", name: "Transfer", icon: "repeat", color: "slate", type: "transfer", system: true, usageCount: 1, totalAmount: 10000, vatDefault: false },
  { id: "c4", name: "Tax Payment", icon: "landmark", color: "red", type: "expense", system: true, usageCount: 1, totalAmount: 12450, vatDefault: false },
  { id: "c5", name: "Plumbing Supplies", icon: "wrench", color: "blue", type: "expense", system: false, usageCount: 45, totalAmount: 45000, vatDefault: true },
  { id: "c6", name: "Labour Income", icon: "hammer", color: "green", type: "income", system: false, usageCount: 112, totalAmount: 120000, vatDefault: true },
  { id: "c7", name: "Fuel", icon: "fuel", color: "orange", type: "expense", system: false, usageCount: 34, totalAmount: 12000, vatDefault: true },
  { id: "c8", name: "Insurance", icon: "shield", color: "indigo", type: "expense", system: false, usageCount: 12, totalAmount: 8500, vatDefault: false },
  { id: "c9", name: "Rent", icon: "home", color: "indigo", type: "expense", system: false, usageCount: 12, totalAmount: 15000, vatDefault: true },
  { id: "c10", name: "Office", icon: "briefcase", color: "slate", type: "expense", system: false, usageCount: 12, totalAmount: 2500, vatDefault: true },
  { id: "c11", name: "Maintenance", icon: "tool", color: "blue", type: "expense", system: false, usageCount: 12, totalAmount: 3500, vatDefault: true },
  { id: "c12", name: "Professional Fees", icon: "file-text", color: "indigo", type: "expense", system: false, usageCount: 12, totalAmount: 7500, vatDefault: true },
  { id: "c13", name: "Rates & Utilities", icon: "zap", color: "yellow", type: "expense", system: false, usageCount: 12, totalAmount: 1250, vatDefault: true },
];

export const formatZAR = (amount: number) => {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
};

export const transactions = [
  { id: "t1", date: "29 Apr 2024", vendor: "Builders Warehouse", description: "Building materials", category: "Plumbing Supplies", kind: "Expense", type: "expense", amount: 3456.78, direction: "outflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Posted", confidence: "high" },
  { id: "t2", date: "28 Apr 2024", vendor: "City of Cape Town", description: "Rates & Utilities", category: "Rates & Utilities", kind: "Expense", type: "expense", amount: 1250.00, direction: "outflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Needs Review", confidence: "medium" },
  { id: "t3", date: "25 Apr 2024", vendor: "Smith Projects", description: "Bathroom renovation", category: "Labour Income", kind: "Income", type: "income", amount: 24500.00, direction: "inflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Posted", confidence: "high" },
  { id: "t4", date: "22 Apr 2024", vendor: "Engen Garage", description: "Bakkie fuel", category: "Fuel", kind: "Expense", type: "expense", amount: 850.00, direction: "outflow", vatInclusive: true, taxCode: "Zero Rate (0%)", status: "Posted", confidence: "high" },
  { id: "t5", date: "15 Apr 2024", vendor: "John Owner", description: "Startup Capital", category: "Capital", kind: "Capital", type: "equity", amount: 50000.00, direction: "inflow", vatInclusive: false, taxCode: "Out of Scope", status: "Owner Funds", confidence: "high" },
  { id: "t6", date: "10 Apr 2024", vendor: "SARS", description: "VAT Payment", category: "Tax Payment", kind: "Tax Payment", type: "expense", amount: 12450.00, direction: "outflow", vatInclusive: false, taxCode: "Out of Scope", status: "Posted", confidence: "high" },
  { id: "t7", date: "05 Apr 2024", vendor: "Plumbing Corp ZA", description: "Pipes and fittings", category: "Plumbing Supplies", kind: "Expense", type: "expense", amount: 15400.20, direction: "outflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Posted", confidence: "high" },
  { id: "t8", date: "02 Apr 2024", vendor: "Discovery Insure", description: "Business Insurance", category: "Insurance", kind: "Expense", type: "expense", amount: 1200.00, direction: "outflow", vatInclusive: false, taxCode: "Standard Rated (15%)", status: "Draft", confidence: "low" },
  { id: "t9", date: "01 Apr 2024", vendor: "John Owner", description: "Director Loan", category: "Owner Loan", kind: "OwnerLoan", type: "liability", amount: 25000.00, direction: "inflow", vatInclusive: false, taxCode: "Out of Scope", status: "Owner Funds", confidence: "high" },
  { id: "t10", date: "28 Mar 2024", vendor: "Savings Account", description: "Transfer to Savings", category: "Transfer", kind: "Transfer", type: "transfer", amount: 10000.00, direction: "outflow", vatInclusive: false, taxCode: "Out of Scope", status: "Posted", confidence: "high" },
  { id: "t11", date: "25 Mar 2024", vendor: "ABC Construction", description: "Site works", category: "Labour Income", kind: "Income", type: "income", amount: 42000.00, direction: "inflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Posted", confidence: "high" },
  { id: "t12", date: "20 Mar 2024", vendor: "Makro", description: "Office supplies", category: "Office", kind: "Expense", type: "expense", amount: 540.50, direction: "outflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Posted", confidence: "high" },
  { id: "t13", date: "15 Mar 2024", vendor: "Property Co", description: "Workshop Rent", category: "Rent", kind: "Expense", type: "expense", amount: 15000.00, direction: "outflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Posted", confidence: "high" },
  { id: "t14", date: "12 Mar 2024", vendor: "Builders Warehouse", description: "Tools", category: "Maintenance", kind: "Expense", type: "expense", amount: 2450.00, direction: "outflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Needs Review", confidence: "medium" },
  { id: "t15", date: "10 Mar 2024", vendor: "Accountant Inc", description: "Tax filing", category: "Professional Fees", kind: "Expense", type: "expense", amount: 3500.00, direction: "outflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Posted", confidence: "high" },
  { id: "t16", date: "05 Mar 2024", vendor: "Jane Doe", description: "Emergency repair", category: "Labour Income", kind: "Income", type: "income", amount: 12000.00, direction: "inflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Posted", confidence: "high" },
  { id: "t17", date: "01 Mar 2024", vendor: "Engen Garage", description: "Fuel", category: "Fuel", kind: "Expense", type: "expense", amount: 920.00, direction: "outflow", vatInclusive: true, taxCode: "Zero Rate (0%)", status: "Posted", confidence: "high" },
  { id: "t18", date: "28 Feb 2024", vendor: "Builders Warehouse", description: "Cement", category: "Plumbing Supplies", kind: "Expense", type: "expense", amount: 1800.00, direction: "outflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Posted", confidence: "high" },
  { id: "t19", date: "25 Feb 2024", vendor: "City of Cape Town", description: "Water & Lights", category: "Rates & Utilities", kind: "Expense", type: "expense", amount: 1150.00, direction: "outflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Posted", confidence: "high" },
  { id: "t20", date: "20 Feb 2024", vendor: "Peter Pan", description: "Geyser installation", category: "Labour Income", kind: "Income", type: "income", amount: 18500.00, direction: "inflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Posted", confidence: "high" },
  { id: "t21", date: "15 Feb 2024", vendor: "Plumbing Corp ZA", description: "Geyser unit", category: "Plumbing Supplies", kind: "Expense", type: "expense", amount: 8500.00, direction: "outflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Posted", confidence: "high" },
  { id: "t22", date: "10 Feb 2024", vendor: "Discovery Insure", description: "Business Insurance", category: "Insurance", kind: "Expense", type: "expense", amount: 1200.00, direction: "outflow", vatInclusive: false, taxCode: "Standard Rated (15%)", status: "Posted", confidence: "high" },
  { id: "t23", date: "05 Feb 2024", vendor: "Engen Garage", description: "Fuel", category: "Fuel", kind: "Expense", type: "expense", amount: 880.00, direction: "outflow", vatInclusive: true, taxCode: "Zero Rate (0%)", status: "Posted", confidence: "high" },
  { id: "t24", date: "01 Feb 2024", vendor: "Property Co", description: "Workshop Rent", category: "Rent", kind: "Expense", type: "expense", amount: 15000.00, direction: "outflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Posted", confidence: "high" },
  { id: "t25", date: "28 Jan 2024", vendor: "XYZ Developments", description: "New build plumbing", category: "Labour Income", kind: "Income", type: "income", amount: 35000.00, direction: "inflow", vatInclusive: true, taxCode: "Standard Rated (15%)", status: "Posted", confidence: "high" },
];

// Curated to show all transaction kinds: Income, Expense, Capital, Tax Payment, Owner Loan, Transfer, Needs Review, Draft
export const recentTransactions = [
  transactions[0],  // t1  Builders Warehouse — Expense / Posted
  transactions[2],  // t3  Smith Projects     — Income / Posted
  transactions[4],  // t5  John Owner Capital — Capital / Owner Funds
  transactions[5],  // t6  SARS VAT Payment   — Tax Payment / Posted
  transactions[8],  // t9  John Owner Loan    — Owner Loan / Owner Funds
  transactions[9],  // t10 Savings Transfer   — Transfer / Posted
  transactions[1],  // t2  City of Cape Town  — Expense / Needs Review
  transactions[7],  // t8  Discovery Insure   — Expense / Draft
];
