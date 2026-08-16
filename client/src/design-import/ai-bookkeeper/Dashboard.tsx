import React from "react";
import { AppShell } from "./_shared/AppShell";
import { 
  dashboardMetrics, 
  sixMonthProfitTrend,
  formatZAR, 
  recentTransactions, 
  vatSummary, 
  irp6 
} from "./_shared/MockData";
import { 
  Upload, 
  MessageSquare, 
  ArrowRight,
  Plus,
  BookOpen,
  AlertCircle,
  ChevronDown,
  BarChart3
} from "lucide-react";
import "./_group.css";

export default function Dashboard() {
  return (
    <AppShell activePage="Dashboard">
      <div className="p-4 sm:p-8 max-w-[1536px] mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-bold text-[var(--text-primary)] leading-tight">Good morning, John.</h1>
            <p className="text-[14px] text-[var(--text-secondary)] mt-1">Here's what's happening at Acme Plumbing (Pty) Ltd.</p>
          </div>
          <button className="hidden sm:flex items-center gap-2 bg-white border border-[var(--border)] rounded-md px-4 py-2 text-[14px] font-medium shadow-sm hover:bg-[var(--surface-subtle)] transition-colors">
            <span className="text-[var(--text-primary)]">Apr 2024</span>
            <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard 
            title="Revenue" 
            value={formatZAR(dashboardMetrics.revenue)} 
            trend="↑9.2% vs last period" 
            trendUp={true}
            valueColor="var(--text-primary)"
          />
          <MetricCard 
            title="Expenses" 
            value={formatZAR(dashboardMetrics.expenses)} 
            trend="↑3.1% vs last period" 
            trendUp={false}
            valueColor="var(--danger)"
          />
          <MetricCard 
            title="Net Profit" 
            value={formatZAR(dashboardMetrics.netProfit)} 
            trend="↑9.9% vs last period" 
            trendUp={true}
            valueColor="var(--success)"
          />
          <MetricCard 
            title="Transactions" 
            value={dashboardMetrics.transactionCount.toString()} 
            trend="this period · all activity" 
            trendUp={true}
            trendNeutral={true}
            valueColor="var(--text-primary)"
          />
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col xl:flex-row gap-8">
          
          {/* Left Column (Main) */}
          <div className="flex-1 space-y-8 min-w-0">
            
            {/* Add Transaction Section */}
            <div>
              <h2 className="text-[17px] font-bold mb-4">Process with AI</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Upload Card */}
                <button className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[var(--border-strong)] rounded-xl bg-white hover:bg-[var(--primary-subtle)] hover:border-[var(--primary)] transition-colors group h-[160px]">
                  <Upload className="w-6 h-6 text-[var(--text-muted)] group-hover:text-[var(--primary)] mb-3" />
                  <span className="text-[14px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)]">Upload receipt or PDF</span>
                  <span className="text-[13px] text-[var(--text-secondary)] mt-1">Drag & drop or browse</span>
                </button>

                {/* Natural Language Card */}
                <div className="flex flex-col p-5 border border-[var(--border)] rounded-xl bg-white shadow-sm h-[160px]">
                  <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text-primary)] mb-3">
                    <MessageSquare className="w-5 h-5 text-[var(--primary)]" />
                    Natural Language
                  </div>
                  <textarea 
                    placeholder="e.g. Paid R1,500 to the plumber on 3 April" 
                    className="w-full bg-[var(--surface-subtle)] border border-[var(--border)] rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent mb-3 resize-none flex-1"
                  />
                  <div className="flex justify-end">
                    <button className="bg-[var(--primary)] text-white px-4 py-1.5 rounded-md text-[13px] font-medium hover:bg-[var(--primary-hover)] transition-colors">
                      Process with AI
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Recent Transactions Table */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[17px] font-bold">Recent Transactions</h2>
                <a href="#" className="text-[13px] font-medium text-[var(--primary)] hover:text-[var(--primary-hover)] flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </a>
              </div>
              
              <div className="bg-white border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[var(--surface-subtle)] border-b border-[var(--border)] text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Category</th>
                      <th className="px-4 py-3 hidden sm:table-cell">Kind</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {recentTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer text-[14px]">
                        <td className="px-4 py-3 whitespace-nowrap text-[var(--text-secondary)]">{tx.date}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[var(--text-primary)] truncate max-w-[150px] sm:max-w-[200px]">{tx.description}</div>
                          <div className="text-[12px] text-[var(--text-muted)] mt-0.5">{tx.vendor}</div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border)]">
                            {tx.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <KindBadge kind={tx.kind} />
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap">
                          <AmountDisplay amount={tx.amount} kind={tx.kind} direction={tx.direction} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={tx.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right Rail (330px) */}
          <div className="xl:w-[330px] flex-shrink-0 space-y-6">
            
            {/* Profit Overview */}
            <div className="bg-white border border-[var(--border)] rounded-xl shadow-sm p-5">
              <h3 className="text-[14px] font-bold mb-3">Profit Overview</h3>
              <div className="mb-3">
                <div className="text-[22px] font-bold tabular-nums text-[var(--success)]">
                  {formatZAR(58903.00)}
                </div>
                <div className="text-[13px] text-[var(--text-secondary)] flex items-center gap-1.5 mt-1">
                  <span className="font-medium">Apr 2024</span>
                  <span className="text-[var(--text-muted)]">•</span>
                  <span className="text-[var(--success)] font-medium">↑15.1% vs Mar</span>
                </div>
              </div>

              {/* SVG Area Chart */}
              <div className="h-[80px] w-full relative">
                <svg viewBox="0 0 280 80" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--success)" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="var(--success)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path 
                    d="M 0 60 Q 30 40, 56 50 T 112 35 T 168 40 T 224 20 T 280 5 L 280 80 L 0 80 Z" 
                    fill="url(#profitGradient)" 
                  />
                  <path 
                    d="M 0 60 Q 30 40, 56 50 T 112 35 T 168 40 T 224 20 T 280 5" 
                    fill="none" 
                    stroke="var(--success)" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                  <circle cx="280" cy="5" r="4" fill="var(--success)" />
                </svg>
              </div>

              <div className="flex justify-between text-[12px] text-[var(--text-muted)] font-medium mt-2 px-1">
                {sixMonthProfitTrend.map(t => (
                  <span key={t.month}>{t.month}</span>
                ))}
              </div>
            </div>

            {/* VAT201 */}
            <div className="bg-white border border-[var(--border)] rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-bold">VAT201</h3>
                <span className="text-[13px] text-[var(--text-secondary)]">{vatSummary.period}</span>
              </div>
              <div className="text-[13px] text-[var(--text-secondary)] mb-1">Net VAT Payable</div>
              <div className="text-[24px] font-bold tabular-nums text-[var(--danger)] mb-1">
                {formatZAR(vatSummary.netVat)}
              </div>
              <div className="text-[13px] text-[var(--text-secondary)] flex items-center gap-1 mb-4">
                <AlertCircle className="w-3.5 h-3.5 text-[var(--warning)]" />
                Due {vatSummary.dueDate}
              </div>
              <button className="w-full bg-white border border-[var(--border-strong)] text-[var(--text-primary)] py-2 rounded-md text-[13px] font-medium hover:bg-[var(--surface-subtle)] transition-colors">
                View VAT Return
              </button>
            </div>

            {/* IRP6 */}
            <div className="bg-white border border-[var(--border)] rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-bold">IRP6 Provisional</h3>
                <span className="text-[13px] text-[var(--text-secondary)]">{irp6.taxYear} Tax Year</span>
              </div>
              <div className="text-[13px] text-[var(--text-secondary)] mb-1">Estimated Period Amount</div>
              <div className="text-[24px] font-bold tabular-nums text-[var(--violet)] mb-4">
                {formatZAR(irp6.provisionalAmount)}
              </div>
              <button className="w-full bg-white border border-[var(--border-strong)] text-[var(--text-primary)] py-2 rounded-md text-[13px] font-medium hover:bg-[var(--surface-subtle)] transition-colors">
                View IRP6
              </button>
            </div>

            {/* Quick Actions */}
            <div className="bg-white border border-[var(--border)] rounded-xl shadow-sm p-5">
              <h3 className="text-[14px] font-bold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <QuickAction icon={Plus} label="Add Transaction" />
                <QuickAction icon={Upload} label="Upload Receipt" />
                <QuickAction icon={BookOpen} label="View Ledger" />
                <QuickAction icon={BarChart3} label="View Reports" />
              </div>
            </div>

          </div>

        </div>

      </div>
    </AppShell>
  );
}

function MetricCard({ title, value, trend, trendUp, trendNeutral, valueColor }: any) {
  return (
    <div className="bg-white border border-[var(--border)] p-4 sm:p-6 rounded-xl shadow-sm flex flex-col">
      <div className="text-[13px] font-medium text-[var(--text-secondary)] mb-2">{title}</div>
      <div className="text-[22px] sm:text-[28px] font-bold tabular-nums mb-3" style={{ color: valueColor || 'var(--text-primary)' }}>
        {value}
      </div>
      <div className="mt-auto">
        {trendNeutral ? (
          <span className="text-[13px] text-[var(--text-secondary)]">{trend}</span>
        ) : (
          <span className={`text-[13px] font-medium ${trendUp ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  if (kind === "Income")
    return <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-[var(--success-subtle)] text-[var(--success)] border border-[var(--success)]/20">Income</span>;
  if (kind === "Expense")
    return <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger)]/20">Expense</span>;
  if (kind === "Tax Payment")
    return <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-[var(--violet-subtle)] text-[var(--violet)] border border-[var(--violet)]/20">Tax Payment</span>;
  if (kind === "Transfer")
    return <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-slate-100 text-slate-700 border border-slate-200">Transfer</span>;
  if (kind === "Capital" || kind === "OwnerLoan")
    return <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-[var(--warning-subtle)] text-[var(--warning)] border border-[var(--warning)]/20">Owner Funds</span>;
  return null;
}

function AmountDisplay({ amount, kind, direction }: { amount: number; kind: string; direction: string }) {
  const formatted = formatZAR(Math.abs(amount));
  if (kind === "Capital" || kind === "OwnerLoan")
    return <span className="text-[var(--warning)]">{formatted}</span>;
  if (kind === "Tax Payment")
    return <span className="text-[var(--violet)]">{direction === "outflow" ? "-" : ""}{formatted}</span>;
  if (kind === "Transfer")
    return <span className="text-slate-600">{direction === "outflow" ? "-" : ""}{formatted}</span>;
  const isIncome = direction === "inflow";
  return (
    <span className={isIncome ? "text-[var(--success)]" : "text-[var(--danger)]"}>
      {isIncome ? "" : "-"}{formatted}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Posted")
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-strong)]">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)]"></div> Posted
      </span>
    );
  if (status === "Needs Review")
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium bg-[var(--warning-subtle)] text-[var(--warning)] border border-[var(--warning)]/20">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--warning)]"></div> Needs Review
      </span>
    );
  if (status === "Owner Funds")
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium bg-[var(--warning-subtle)] text-[var(--warning)] border border-[var(--warning)]/20">
        Owner Funds
      </span>
    );
  if (status === "Failed")
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger)]/20">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--danger)]"></div> Failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium bg-[var(--surface-subtle)] text-[var(--text-muted)] border border-[var(--border)]">
      Draft
    </span>
  );
}

function QuickAction({ icon: Icon, label }: any) {
  return (
    <button className="flex flex-col items-center justify-center p-3 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-subtle)] transition-colors gap-2">
      <Icon className="w-5 h-5 text-[var(--text-secondary)]" />
      <span className="text-[13px] font-medium text-[var(--text-primary)]">{label}</span>
    </button>
  );
}
