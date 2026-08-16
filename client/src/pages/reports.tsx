import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Download, Calendar, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from "lucide-react";
import { type TransactionWithCategory } from "@shared/schema";
import { formatCurrency, formatDateInput } from "@/lib/utils";
import { useOrgFetch } from "@/context/organisation-context";

function ChangeIndicator({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null || previous === 0) return null;
  
  const change = current - previous;
  const percentChange = (change / previous) * 100;
  
  if (Math.abs(percentChange) < 0.1) return null;
  
  return (
    <span className={`text-xs flex items-center gap-1 ${change >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
      {change >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {Math.abs(percentChange).toFixed(1)}%
    </span>
  );
}

function getDateRange(range: string, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (range) {
    case "custom":
      // Custom date range from user input
      if (customStart) {
        const customStartDate = new Date(customStart);
        customStartDate.setHours(0, 0, 0, 0);
        start.setTime(customStartDate.getTime());
      } else {
        start.setDate(1); // Default to start of current month
        start.setHours(0, 0, 0, 0);
      }
      
      if (customEnd) {
        const customEndDate = new Date(customEnd);
        customEndDate.setHours(23, 59, 59, 999);
        end.setTime(customEndDate.getTime());
      } else {
        end.setHours(23, 59, 59, 999); // Default to today
      }
      break;
    case "this-month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "last-month":
      start.setMonth(start.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "this-quarter":
      const currentQuarter = Math.floor(now.getMonth() / 3);
      start.setMonth(currentQuarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth((currentQuarter + 1) * 3, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "last-quarter":
      const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
      const quarterYear = lastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const adjustedQuarter = lastQuarter < 0 ? 3 : lastQuarter;
      start.setFullYear(quarterYear, adjustedQuarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(quarterYear, (adjustedQuarter + 1) * 3, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "this-year":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
    case "last-year":
      start.setFullYear(start.getFullYear() - 1, 0, 1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(end.getFullYear() - 1, 11, 31);
      end.setHours(23, 59, 59, 999);
      break;
    case "all-time":
    default:
      start.setFullYear(2000, 0, 1);
      end.setFullYear(2099, 11, 31);
      break;
  }

  return { start, end };
}

export default function Reports() {
  const { selectedOrgId, orgFetch } = useOrgFetch();
  const [dateRange, setDateRange] = useState<string>("this-month");
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    return formatDateInput(firstOfMonth);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => formatDateInput(new Date()));
  
  const { data: transactions, isLoading } = useQuery<TransactionWithCategory[]>({
    queryKey: ["/api/transactions", selectedOrgId],
    queryFn: orgFetch('/api/transactions'),
  });

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    const { start, end } = getDateRange(dateRange, customStartDate, customEndDate);
    return transactions.filter(t => {
      const date = new Date(t.date);
      return date >= start && date <= end;
    });
  }, [transactions, dateRange, customStartDate, customEndDate]);

  const { incomeStatement, balanceSheet, cashFlow, trialBalance, previousPeriod } = useMemo(() => {
    const calculatePeriod = (txns: TransactionWithCategory[]) => {
      // CRITICAL: Only include transactions that explicitly affect profit (exclude capital, owner_loan, transfer)
      // Use strict === true check to exclude null/undefined values
      const profitAffectingTxns = txns.filter(t => t.affectsProfit === true);
      
      const revenue = profitAffectingTxns
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const expensesByCategory = profitAffectingTxns
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
          const categoryName = t.category?.name || 'Uncategorized';
          acc[categoryName] = (acc[categoryName] || 0) + parseFloat(t.amount);
          return acc;
        }, {} as Record<string, number>);

      const totalExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0);
      const netIncome = revenue - totalExpenses;

      return { revenue, expensesByCategory, totalExpenses, netIncome };
    };

    const current = calculatePeriod(filteredTransactions);
    
    // Balance Sheet calculation (cumulative up to end date)
    const { start: _, end } = getDateRange(dateRange, customStartDate, customEndDate);
    const cumulativeTransactions = transactions?.filter(t => {
      const date = new Date(t.date);
      return date <= end;
    }) || [];
    
    const totalRevenue = cumulativeTransactions
      .filter(t => t.type === 'income' && t.affectsProfit === true)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const totalExpensesCumulative = cumulativeTransactions
      .filter(t => t.type === 'expense' && t.affectsProfit === true)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const retainedEarnings = totalRevenue - totalExpensesCumulative;
    
    // CRITICAL: Use signed arithmetic - inflows add, outflows subtract
    const capitalContributions = cumulativeTransactions
      .filter(t => t.kind === 'capital')
      .reduce((sum, t) => {
        const amount = parseFloat(t.amount);
        return t.direction === 'inflow' ? sum + amount : sum - amount;
      }, 0);
    
    const directorsLoans = cumulativeTransactions
      .filter(t => t.kind === 'owner_loan')
      .reduce((sum, t) => {
        const amount = parseFloat(t.amount);
        return t.direction === 'inflow' ? sum + amount : sum - amount;
      }, 0);
    
    const totalEquity = retainedEarnings + capitalContributions;
    const totalLiabilities = directorsLoans;
    const totalAssets = totalEquity + totalLiabilities;
    
    // Cash Flow calculation
    const cashInflows = filteredTransactions
      .filter(t => t.direction === 'inflow')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const cashOutflows = filteredTransactions
      .filter(t => t.direction === 'outflow')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const operatingCashFlow = filteredTransactions
      .filter(t => t.affectsProfit === true)
      .reduce((sum, t) => {
        const amount = parseFloat(t.amount);
        return t.direction === 'inflow' ? sum + amount : sum - amount;
      }, 0);
    
    const financingCashFlow = filteredTransactions
      .filter(t => t.kind === 'capital' || t.kind === 'owner_loan')
      .reduce((sum, t) => {
        const amount = parseFloat(t.amount);
        return t.direction === 'inflow' ? sum + amount : sum - amount;
      }, 0);
    
    const netCashFlow = cashInflows - cashOutflows;

    // Calculate previous period
    if (!transactions || dateRange === 'all-time') {
      return { 
        incomeStatement: current,
        balanceSheet: {
          totalAssets,
          totalEquity,
          retainedEarnings,
          capitalContributions,
          totalLiabilities,
          directorsLoans
        },
        cashFlow: {
          operatingCashFlow,
          financingCashFlow,
          netCashFlow,
          cashInflows,
          cashOutflows
        },
        trialBalance: filteredTransactions,
        previousPeriod: null 
      };
    }

    // For custom date ranges, disable previous period comparison (misleading)
    let previous = null;
    if (dateRange !== 'custom') {
      const { start: currentStart, end: currentEnd } = getDateRange(dateRange, customStartDate, customEndDate);
      const periodLength = currentEnd.getTime() - currentStart.getTime();
      const previousStart = new Date(currentStart.getTime() - periodLength);
      const previousEnd = new Date(currentEnd.getTime() - periodLength);

      const previousTransactions = transactions.filter(t => {
        const date = new Date(t.date);
        return date >= previousStart && date <= previousEnd;
      });

      previous = calculatePeriod(previousTransactions);
    }

    return { 
      incomeStatement: current, 
      balanceSheet: {
        totalAssets,
        totalEquity,
        retainedEarnings,
        capitalContributions,
        totalLiabilities,
        directorsLoans
      },
      cashFlow: {
        operatingCashFlow,
        financingCashFlow,
        netCashFlow,
        cashInflows,
        cashOutflows
      },
      trialBalance: filteredTransactions,
      previousPeriod: previous 
    };
  }, [filteredTransactions, transactions, dateRange, customStartDate, customEndDate]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Financial Reports</h1>
          <p className="text-muted-foreground">Business financial statements and documentation</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-reports-title">Financial Reports</h1>
          <p className="text-muted-foreground">Business financial statements and documentation</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-48" data-testid="select-date-range">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">Custom Range</SelectItem>
              <Separator className="my-1" />
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="this-quarter">This Quarter</SelectItem>
              <SelectItem value="last-quarter">Last Quarter</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
              <SelectItem value="last-year">Last Year</SelectItem>
              <SelectItem value="all-time">All Time</SelectItem>
            </SelectContent>
          </Select>
          
          {dateRange === "custom" && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Label htmlFor="custom-start-date" className="text-sm text-muted-foreground">From:</Label>
                <Input
                  id="custom-start-date"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-40"
                  data-testid="input-custom-start-date"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="custom-end-date" className="text-sm text-muted-foreground">To:</Label>
                <Input
                  id="custom-end-date"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-40"
                  data-testid="input-custom-end-date"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="income-statement" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="income-statement" data-testid="tab-income-statement">
            Income Statement
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" data-testid="tab-balance-sheet">
            Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="cash-flow" data-testid="tab-cash-flow">
            Cash Flow
          </TabsTrigger>
          <TabsTrigger value="trial-balance" data-testid="tab-trial-balance">
            Trial Balance
          </TabsTrigger>
          <TabsTrigger value="management" data-testid="tab-management">
            Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income-statement" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Income Statement</CardTitle>
                <CardDescription>Statement of Profit or Loss and Other Comprehensive Income</CardDescription>
              </div>
              <Button variant="outline" size="sm" data-testid="button-export-income-pdf">
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {filteredTransactions.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No transactions found for the selected period</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Revenue</h3>
                      <div className="space-y-2 pl-4">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Total Income</span>
                          <div className="flex items-center gap-3">
                            <ChangeIndicator current={incomeStatement.revenue} previous={previousPeriod?.revenue || null} />
                            <span className="font-mono text-green-600 dark:text-green-500" data-testid="value-total-revenue">
                              {formatCurrency(incomeStatement.revenue)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold text-lg mb-3">Operating Expenses</h3>
                      <div className="space-y-2 pl-4">
                        {Object.entries(incomeStatement.expensesByCategory)
                          .sort((a, b) => b[1] - a[1])
                          .map(([category, amount]) => (
                            <div key={category} className="flex justify-between items-center">
                              <span className="text-muted-foreground">{category}</span>
                              <div className="flex items-center gap-3">
                                <ChangeIndicator 
                                  current={amount} 
                                  previous={previousPeriod?.expensesByCategory[category] || null} 
                                />
                                <span className="font-mono" data-testid={`value-expense-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                                  {formatCurrency(amount)}
                                </span>
                              </div>
                            </div>
                          ))}
                        <Separator className="my-2" />
                        <div className="flex justify-between items-center font-semibold">
                          <span>Total Expenses</span>
                          <div className="flex items-center gap-3">
                            <ChangeIndicator current={incomeStatement.totalExpenses} previous={previousPeriod?.totalExpenses || null} />
                            <span className="font-mono" data-testid="value-total-expenses">
                              {formatCurrency(incomeStatement.totalExpenses)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="bg-muted/30 p-4 rounded-md">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-xl">Net Income</h3>
                          {incomeStatement.netIncome >= 0 ? (
                            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-500" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <ChangeIndicator current={incomeStatement.netIncome} previous={previousPeriod?.netIncome || null} />
                          <span 
                            className={`font-mono text-xl font-bold ${
                              incomeStatement.netIncome >= 0 
                                ? 'text-green-600 dark:text-green-500' 
                                : 'text-red-600 dark:text-red-500'
                            }`}
                            data-testid="value-net-income"
                          >
                            {formatCurrency(incomeStatement.netIncome)}
                          </span>
                        </div>
                      </div>
                      {incomeStatement.revenue > 0 && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          Profit Margin: {((incomeStatement.netIncome / incomeStatement.revenue) * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance-sheet" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Balance Sheet</CardTitle>
                <CardDescription>Statement of Financial Position as of {new Date(getDateRange(dateRange, customStartDate, customEndDate).end).toLocaleDateString()}</CardDescription>
              </div>
              <Button variant="outline" size="sm" data-testid="button-export-balance-pdf">
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-3">Assets</h3>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Cash and Cash Equivalents</span>
                      <span className="font-mono" data-testid="value-total-assets">
                        {formatCurrency(balanceSheet.totalAssets)}
                      </span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between items-center font-semibold">
                      <span>Total Assets</span>
                      <span className="font-mono">
                        {formatCurrency(balanceSheet.totalAssets)}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-3">Liabilities</h3>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Director's Loans</span>
                      <span className="font-mono" data-testid="value-directors-loans">
                        {formatCurrency(balanceSheet.directorsLoans)}
                      </span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between items-center font-semibold">
                      <span>Total Liabilities</span>
                      <span className="font-mono">
                        {formatCurrency(balanceSheet.totalLiabilities)}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-3">Equity</h3>
                  <div className="space-y-2 pl-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Capital Contributions</span>
                      <span className="font-mono" data-testid="value-capital">
                        {formatCurrency(balanceSheet.capitalContributions)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Retained Earnings</span>
                      <span className="font-mono" data-testid="value-retained-earnings">
                        {formatCurrency(balanceSheet.retainedEarnings)}
                      </span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between items-center font-semibold">
                      <span>Total Equity</span>
                      <span className="font-mono">
                        {formatCurrency(balanceSheet.totalEquity)}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="bg-muted/30 p-4 rounded-md">
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span>Total Liabilities + Equity</span>
                    <span className="font-mono">
                      {formatCurrency(balanceSheet.totalLiabilities + balanceSheet.totalEquity)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash-flow" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Cash Flow Statement</CardTitle>
                <CardDescription>Statement of Cash Flows for the selected period</CardDescription>
              </div>
              <Button variant="outline" size="sm" data-testid="button-export-cashflow-pdf">
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {filteredTransactions.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No transactions found for the selected period</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Operating Activities</h3>
                    <div className="space-y-2 pl-4">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Cash from Operations</span>
                        <span className={`font-mono ${cashFlow.operatingCashFlow >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`} data-testid="value-operating-cashflow">
                          {formatCurrency(cashFlow.operatingCashFlow)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-semibold text-lg mb-3">Financing Activities</h3>
                    <div className="space-y-2 pl-4">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Capital & Loans (Net)</span>
                        <span className={`font-mono ${cashFlow.financingCashFlow >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`} data-testid="value-financing-cashflow">
                          {formatCurrency(cashFlow.financingCashFlow)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="bg-muted/30 p-4 rounded-md">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-xl">Net Cash Flow</h3>
                      <span 
                        className={`font-mono text-xl font-bold ${
                          cashFlow.netCashFlow >= 0 
                            ? 'text-green-600 dark:text-green-500' 
                            : 'text-red-600 dark:text-red-500'
                        }`}
                        data-testid="value-net-cashflow"
                      >
                        {formatCurrency(cashFlow.netCashFlow)}
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Total Inflows</div>
                        <div className="font-mono text-green-600 dark:text-green-500">
                          {formatCurrency(cashFlow.cashInflows)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Total Outflows</div>
                        <div className="font-mono text-red-600 dark:text-red-500">
                          {formatCurrency(cashFlow.cashOutflows)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trial-balance" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Trial Balance</CardTitle>
                <CardDescription>Detailed transaction ledger for the selected period</CardDescription>
              </div>
              <Button variant="outline" size="sm" data-testid="button-export-trial-pdf">
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </CardHeader>
            <CardContent>
              {filteredTransactions.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No transactions found for the selected period</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-semibold">Date</th>
                        <th className="text-left py-3 px-2 font-semibold">Description</th>
                        <th className="text-left py-3 px-2 font-semibold">Category</th>
                        <th className="text-right py-3 px-2 font-semibold">Debit</th>
                        <th className="text-right py-3 px-2 font-semibold">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialBalance
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((txn, idx) => (
                        <tr key={txn.id} className="border-b hover-elevate" data-testid={`trial-row-${idx}`}>
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {new Date(txn.date).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              {txn.description}
                              {txn.kind === 'capital' && <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-500 px-2 py-0.5 rounded">Capital</span>}
                              {txn.kind === 'owner_loan' && <span className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-500 px-2 py-0.5 rounded">Loan</span>}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-sm text-muted-foreground">
                            {txn.category?.name || 'Uncategorized'}
                          </td>
                          <td className="py-3 px-2 text-right font-mono">
                            {txn.type === 'expense' || txn.direction === 'outflow' 
                              ? formatCurrency(parseFloat(txn.amount))
                              : '—'
                            }
                          </td>
                          <td className="py-3 px-2 text-right font-mono">
                            {txn.type === 'income' || txn.direction === 'inflow'
                              ? formatCurrency(parseFloat(txn.amount))
                              : '—'
                            }
                          </td>
                        </tr>
                      ))}
                      <tr className="font-semibold bg-muted/30">
                        <td colSpan={3} className="py-3 px-2 text-right">Totals:</td>
                        <td className="py-3 px-2 text-right font-mono">
                          {formatCurrency(
                            trialBalance
                              .filter(t => t.type === 'expense' || t.direction === 'outflow')
                              .reduce((sum, t) => sum + parseFloat(t.amount), 0)
                          )}
                        </td>
                        <td className="py-3 px-2 text-right font-mono">
                          {formatCurrency(
                            trialBalance
                              .filter(t => t.type === 'income' || t.direction === 'inflow')
                              .reduce((sum, t) => sum + parseFloat(t.amount), 0)
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="management" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Management Accounts</CardTitle>
                <CardDescription>Key performance metrics for the selected period</CardDescription>
              </div>
              <Button variant="outline" size="sm" data-testid="button-export-management-pdf">
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {filteredTransactions.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No transactions found for the selected period</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-500" data-testid="mgmt-revenue">
                        {formatCurrency(incomeStatement.revenue)}
                      </div>
                      {previousPeriod && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <ChangeIndicator current={incomeStatement.revenue} previous={previousPeriod.revenue} />
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="mgmt-expenses">
                        {formatCurrency(incomeStatement.totalExpenses)}
                      </div>
                      {previousPeriod && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <ChangeIndicator current={incomeStatement.totalExpenses} previous={previousPeriod.totalExpenses} />
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Net Profit/Loss</CardTitle>
                      {incomeStatement.netIncome >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-500" />
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${incomeStatement.netIncome >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`} data-testid="mgmt-profit">
                        {formatCurrency(incomeStatement.netIncome)}
                      </div>
                      {previousPeriod && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <ChangeIndicator current={incomeStatement.netIncome} previous={previousPeriod.netIncome} />
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Transaction Count</CardTitle>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="mgmt-count">
                        {filteredTransactions.length}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        transactions in period
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Expense Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(incomeStatement.expensesByCategory)
                          .sort((a, b) => b[1] - a[1])
                          .map(([category, amount]) => {
                            const percentage = incomeStatement.totalExpenses > 0 
                              ? (amount / incomeStatement.totalExpenses) * 100 
                              : 0;
                            return (
                              <div key={category} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">{category}</span>
                                  <span className="font-mono">{formatCurrency(amount)} ({percentage.toFixed(0)}%)</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                  <div 
                                    className="bg-primary h-2 rounded-full transition-all" 
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
