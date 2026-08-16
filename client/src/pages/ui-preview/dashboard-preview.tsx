import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Plus, CloudUpload, BarChart3, FileText, Calculator, ArrowRight, Sparkles,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatDate, getCategoryColor } from '@/lib/utils';
import { useOrgFetch, useOrganisation } from '@/context/organisation-context';
import { BookkeeperPreviewShell } from '@/components/bookkeeper/BookkeeperPreviewShell';
import {
  BkMetricCard, BkKindBadge, BkAmount, BkPanel, BkProfitTrendChart, type ProfitTrendPoint,
} from '@/components/bookkeeper/ui';
import { type TransactionWithCategory } from '@shared/schema';

// ─── Period helpers (same behaviour as production dashboard) ──────────────────

type Period = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all_time';
const PERIOD_LABELS: Record<Period, string> = {
  this_month: 'This Month',
  last_month: 'Last Month',
  this_quarter: 'This Quarter',
  this_year: 'This Year',
  all_time: 'All Time',
};

function getPeriodDates(period: Period): { start: Date | null; end: Date | null } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  switch (period) {
    case 'this_month':  return { start: new Date(y, m, 1), end: now };
    case 'last_month':  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59) };
    case 'this_quarter': {
      const qStart = Math.floor(m / 3) * 3;
      return { start: new Date(y, qStart, 1), end: now };
    }
    case 'this_year':   return { start: new Date(y, 0, 1), end: now };
    case 'all_time':    return { start: null, end: null };
  }
}

function filterByPeriod(txns: TransactionWithCategory[], period: Period) {
  const { start, end } = getPeriodDates(period);
  if (!start && !end) return txns;
  return txns.filter(t => {
    const d = new Date(t.date);
    return (!start || d >= start) && (!end || d <= end);
  });
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Trend view-model: monthly cumulative profit from real transactions ───────

function buildTrendPoints(plTransactions: TransactionWithCategory[]): ProfitTrendPoint[] {
  if (plTransactions.length === 0) return [];
  const byMonth = new Map<string, number>();
  const sorted = [...plTransactions].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  sorted.forEach(t => {
    const key = String(t.date).slice(0, 7);
    const delta = t.type === 'income' ? parseFloat(t.amount) : -parseFloat(t.amount);
    byMonth.set(key, (byMonth.get(key) ?? 0) + delta);
  });
  let cum = 0;
  return Array.from(byMonth.entries()).map(([key, delta]) => {
    cum += delta;
    const monthIdx = parseInt(key.slice(5), 10) - 1;
    return { period: MONTH_NAMES[monthIdx] ?? key, profit: cum };
  });
}

// ─── VAT card (real returns, live-calc fallback) ───────────────────────────────

function VatCard({ plTransactions }: { plTransactions: TransactionWithCategory[] }) {
  const { selectedOrgId, orgFetch } = useOrgFetch();
  const { data: returns } = useQuery<any[]>({
    queryKey: ['/api/vat/returns', selectedOrgId],
    queryFn: orgFetch<any[]>('/api/vat/returns'),
  });
  const latest = returns && returns.length > 0 ? returns[returns.length - 1] : null;

  const vatCalc = useMemo(() => {
    const rate = 15 / 115;
    const stdIncome = plTransactions
      .filter(t => t.type === 'income' && (t.taxCode === 'standard' || !t.taxCode))
      .reduce((s, t) => s + parseFloat(t.amount), 0);
    const stdExpense = plTransactions
      .filter(t => t.type === 'expense' && (t.taxCode === 'standard' || !t.taxCode))
      .reduce((s, t) => s + parseFloat(t.amount), 0);
    return {
      collected: stdIncome * rate,
      claimable: stdExpense * rate,
      payable: stdIncome * rate - stdExpense * rate,
    };
  }, [plTransactions]);

  const rows = latest
    ? {
        collected: parseFloat(latest.outputVat) / 100,
        claimable: parseFloat(latest.inputVat) / 100,
        payable: parseFloat(latest.netVat) / 100,
        note: null as string | null,
      }
    : vatCalc.collected > 0 || vatCalc.claimable > 0
      ? { ...vatCalc, note: 'Estimated from current transactions' }
      : null;

  return (
    <BkPanel className="p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-[var(--bk-primary)] shrink-0" />
          <h3 className="text-[14px] font-bold text-[var(--bk-text-primary)] truncate">
            VAT201 ({latest ? latest.periodKey : 'Current Period'})
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {latest?.status && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bk-warning-subtle)] text-[var(--bk-warning)] border border-[var(--bk-warning)]/20 capitalize">
              {latest.status}
            </span>
          )}
          <Link href="/vat201" className="text-[12px] font-medium text-[var(--bk-primary)] hover:underline flex items-center gap-0.5" data-testid="link-vat201">
            View <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {rows ? (
        <div className="space-y-2.5">
          {rows.note && <p className="text-[11px] text-[var(--bk-text-muted)]">{rows.note}</p>}
          <div className="flex justify-between items-center gap-2">
            <span className="text-[13px] text-[var(--bk-text-secondary)]">VAT Collected</span>
            <span className="text-[13px] font-medium text-[var(--bk-text-primary)] tabular-nums">{formatCurrency(rows.collected)}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-[13px] text-[var(--bk-text-secondary)]">VAT Claimable</span>
            <span className="text-[13px] font-medium text-[var(--bk-text-primary)] tabular-nums">{formatCurrency(rows.claimable)}</span>
          </div>
          <div className="border-t border-[var(--bk-border)] pt-2.5 flex justify-between items-center gap-2">
            <span className="text-[13px] font-semibold text-[var(--bk-text-primary)]">
              {rows.payable >= 0 ? 'VAT Payable' : 'VAT Refund'}
            </span>
            <span
              className="text-[15px] font-bold tabular-nums"
              style={{ color: rows.payable >= 0 ? 'var(--bk-danger)' : 'var(--bk-success)' }}
            >
              {formatCurrency(Math.abs(rows.payable))}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-[var(--bk-text-secondary)]">No returns or transactions yet.</p>
      )}

      <Link
        href="/vat201"
        className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 rounded-md border border-[var(--bk-border)] text-[13px] font-medium text-[var(--bk-text-primary)] hover:bg-[var(--bk-surface-subtle)] transition-colors"
      >
        <FileText className="w-3.5 h-3.5" />View VAT201
      </Link>
    </BkPanel>
  );
}

// ─── IRP6 card ────────────────────────────────────────────────────────────────

function Irp6Card({ netProfit }: { netProfit: number }) {
  const { selectedOrgId, orgFetch } = useOrgFetch();
  const { data: estimates } = useQuery<any[]>({
    queryKey: ['/api/irp6/estimates', selectedOrgId],
    queryFn: orgFetch<any[]>('/api/irp6/estimates'),
  });
  const latest = estimates && estimates.length > 0 ? estimates[estimates.length - 1] : null;

  const estTaxableIncome = Math.max(0, netProfit);
  const estProvTax = estTaxableIncome * 0.28;

  const rows = latest
    ? {
        taxable: parseFloat(latest.taxableIncome) / 100,
        tax: parseFloat(latest.estimatedTax) / 100,
        note: null as string | null,
      }
    : estTaxableIncome > 0
      ? { taxable: estTaxableIncome, tax: estProvTax, note: 'Estimated from current P&L (28% effective rate)' }
      : null;

  return (
    <BkPanel className="p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Calculator className="w-4 h-4 text-[var(--bk-primary)] shrink-0" />
          <h3 className="text-[14px] font-bold text-[var(--bk-text-primary)] truncate">
            {latest ? `IRP6 Estimate (${latest.yearOfAssessment}/${latest.half === 1 ? '01' : '03'})` : 'IRP6 Provisional'}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {latest && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bk-warning-subtle)] text-[var(--bk-warning)] border border-[var(--bk-warning)]/20 capitalize">
              {latest.status ?? 'Draft'}
            </span>
          )}
          <Link href="/irp6" className="text-[12px] font-medium text-[var(--bk-primary)] hover:underline flex items-center gap-0.5" data-testid="link-irp6">
            View <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {rows ? (
        <div className="space-y-2.5">
          {rows.note && <p className="text-[11px] text-[var(--bk-text-muted)]">{rows.note}</p>}
          <div className="flex justify-between items-center gap-2">
            <span className="text-[13px] text-[var(--bk-text-secondary)]">Taxable Income</span>
            <span className="text-[13px] font-medium text-[var(--bk-text-primary)] tabular-nums">{formatCurrency(rows.taxable)}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-[13px] text-[var(--bk-text-secondary)]">Provisional Tax</span>
            <span className="text-[13px] font-semibold text-[var(--bk-danger)] tabular-nums">{formatCurrency(rows.tax)}</span>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-[var(--bk-text-secondary)]">No estimates saved. Add income transactions to see an estimate.</p>
      )}

      <Link
        href="/irp6"
        className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 rounded-md border border-[var(--bk-border)] text-[13px] font-medium text-[var(--bk-text-primary)] hover:bg-[var(--bk-surface-subtle)] transition-colors"
      >
        <Calculator className="w-3.5 h-3.5" />View IRP6
      </Link>
    </BkPanel>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────

function QuickActions() {
  const actions = [
    { label: 'Add Transaction', icon: Plus, href: '/upload', testId: 'link-quick-add-transaction' },
    { label: 'Upload Receipt', icon: CloudUpload, href: '/upload', testId: 'link-quick-upload-receipt' },
    { label: 'New Report', icon: BarChart3, href: '/reports', testId: 'link-quick-reports' },
  ];
  return (
    <BkPanel className="p-5">
      <h3 className="text-[14px] font-bold text-[var(--bk-text-primary)] mb-3">Quick Actions</h3>
      <div className="grid grid-cols-3 gap-2">
        {actions.map(a => (
          <Link
            key={a.label}
            href={a.href}
            data-testid={a.testId}
            className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border border-[var(--bk-border)] hover:border-[var(--bk-primary)] hover:bg-[var(--bk-primary-subtle)] transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--bk-primary-subtle)] flex items-center justify-center">
              <a.icon className="w-4 h-4 text-[var(--bk-primary)]" />
            </div>
            <span className="text-[11px] font-medium text-[var(--bk-text-secondary)] text-center leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>
    </BkPanel>
  );
}

// ─── Empty state (getting-started) ────────────────────────────────────────────

function GettingStarted() {
  return (
    <BkPanel className="p-8 sm:p-12 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--bk-primary-subtle)] flex items-center justify-center mb-4">
        <Sparkles className="w-6 h-6 text-[var(--bk-primary)]" />
      </div>
      <h3 className="text-[18px] font-bold text-[var(--bk-text-primary)] mb-1">Welcome to AI Bookkeeper</h3>
      <p className="text-[14px] text-[var(--bk-text-secondary)] max-w-md mb-6">
        Add your first transaction to see your profit, VAT position and provisional tax estimates come to life.
      </p>
      <Link
        href="/upload"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[var(--bk-primary)] hover:bg-[var(--bk-primary-hover)] text-white text-[14px] font-medium shadow-sm transition-colors"
        data-testid="button-get-started"
      >
        <Plus className="w-4 h-4" />Add your first transaction
      </Link>
    </BkPanel>
  );
}

// ─── Recent transactions table (no Status column) ────────────────────────────

function RecentTransactions({ transactions, isLoading }: { transactions: TransactionWithCategory[]; isLoading: boolean }) {
  const recent = useMemo(
    () => [...transactions].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8),
    [transactions],
  );

  return (
    <BkPanel>
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-[var(--bk-border)]">
        <h3 className="text-[14px] font-bold text-[var(--bk-text-primary)]">Recent Transactions</h3>
        <Link href="/ledger" className="text-[12px] font-medium text-[var(--bk-primary)] hover:underline flex items-center gap-0.5" data-testid="link-view-all-transactions">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {isLoading ? (
        <div className="p-5 space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-10 rounded bg-[var(--bk-surface-subtle)] animate-pulse" />)}
        </div>
      ) : recent.length === 0 ? (
        <p className="p-5 text-[13px] text-[var(--bk-text-secondary)]">No transactions in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[var(--bk-text-muted)] border-b border-[var(--bk-border)]">
                <th className="px-5 py-2.5 font-semibold">Date</th>
                <th className="px-5 py-2.5 font-semibold">Vendor</th>
                <th className="px-5 py-2.5 font-semibold hidden md:table-cell">Category</th>
                <th className="px-5 py-2.5 font-semibold">Type</th>
                <th className="px-5 py-2.5 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(t => (
                <tr key={t.id} className="border-b border-[var(--bk-border)] last:border-0 hover:bg-[var(--bk-surface-subtle)] transition-colors" data-testid={`row-transaction-${t.id}`}>
                  <td className="px-5 py-3 text-[13px] text-[var(--bk-text-secondary)] whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="px-5 py-3">
                    <div className="text-[13px] font-medium text-[var(--bk-text-primary)]">{t.vendor}</div>
                    {t.aiConfidence != null && Number(t.aiConfidence) < 0.6 && (
                      <span className="text-[11px] text-[var(--bk-warning)]">Needs review</span>
                    )}
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    {t.category ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md"
                        style={{ backgroundColor: `${getCategoryColor(t.category.name)}18`, color: getCategoryColor(t.category.name) }}
                      >
                        {t.category.name}
                      </span>
                    ) : (
                      <span className="text-[12px] text-[var(--bk-text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3"><BkKindBadge kind={t.kind} type={t.type} /></td>
                  <td className="px-5 py-3 text-right text-[13px] font-semibold tabular-nums">
                    <BkAmount amount={t.amount} kind={t.kind} type={t.type} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BkPanel>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPreview() {
  const { user } = useAuth();
  const { selectedOrg, selectedOrgId } = useOrganisation();
  const { orgUrl } = useOrgFetch();
  const [period, setPeriod] = useState<Period>('this_month');

  const { data: transactions = [], isLoading } = useQuery<TransactionWithCategory[]>({
    queryKey: ['/api/transactions', selectedOrgId],
    queryFn: () =>
      fetch(orgUrl('/api/transactions'), { credentials: 'include' }).then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      }),
  });

  const periodTransactions = useMemo(() => filterByPeriod(transactions, period), [transactions, period]);
  const plTransactions = useMemo(
    () => periodTransactions.filter(t => !['capital', 'owner_loan', 'tax', 'transfer'].includes(t.kind ?? '')),
    [periodTransactions],
  );
  const incomeTransactions = plTransactions.filter(t => t.type === 'income');
  const expenseTransactions = plTransactions.filter(t => t.type === 'expense');
  const totalIncome = incomeTransactions.reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalExpenses = expenseTransactions.reduce((s, t) => s + parseFloat(t.amount), 0);
  const netProfit = totalIncome - totalExpenses;
  const trendPoints = useMemo(() => buildTrendPoints(plTransactions), [plTransactions]);

  const isEmpty = !isLoading && transactions.length === 0;

  return (
    <BookkeeperPreviewShell activePage="Dashboard">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[22px] sm:text-[26px] font-bold text-[var(--bk-text-primary)] leading-tight" data-testid="text-dashboard-title">
              {getGreeting()}{user?.firstName ? `, ${user.firstName}` : ''}
            </h1>
            <p className="text-[14px] text-[var(--bk-text-secondary)] mt-0.5">
              Here's what's happening with {selectedOrg?.name ?? 'your personal workspace'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Select value={period} onValueChange={v => setPeriod(v as Period)}>
              <SelectTrigger className="h-9 text-[13px] w-40 border-[var(--bk-border)] bg-white" data-testid="select-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                  <SelectItem key={p} value={p} className="text-[13px]">{PERIOD_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isEmpty ? (
          <GettingStarted />
        ) : (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <BkMetricCard
                title="Revenue"
                value={formatCurrency(totalIncome)}
                sub={`${incomeTransactions.length} transaction${incomeTransactions.length !== 1 ? 's' : ''}`}
                valueColor="var(--bk-success)"
                isLoading={isLoading}
                testId="text-total-income"
              />
              <BkMetricCard
                title="Expenses"
                value={formatCurrency(totalExpenses)}
                sub={`${expenseTransactions.length} transaction${expenseTransactions.length !== 1 ? 's' : ''}`}
                valueColor="var(--bk-danger)"
                isLoading={isLoading}
                testId="text-total-expenses"
              />
              <BkMetricCard
                title="Net Profit"
                value={formatCurrency(Math.abs(netProfit))}
                sub={netProfit >= 0 ? 'Positive' : 'Negative — Loss'}
                valueColor={netProfit >= 0 ? 'var(--bk-success)' : 'var(--bk-danger)'}
                isLoading={isLoading}
                testId="text-net-amount"
              />
              <BkMetricCard
                title="Transactions"
                value={String(periodTransactions.length)}
                sub="Total records"
                isLoading={isLoading}
                testId="text-total-transactions"
              />
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
              <div className="space-y-5 min-w-0">
                <RecentTransactions transactions={periodTransactions} isLoading={isLoading} />
              </div>
              <div className="space-y-4">
                <BkPanel className="p-5">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-[14px] font-bold text-[var(--bk-text-primary)]">Profit Overview</h3>
                  </div>
                  <p
                    className="text-[26px] font-bold leading-tight tabular-nums"
                    style={{ color: netProfit >= 0 ? 'var(--bk-success)' : 'var(--bk-danger)' }}
                    data-testid="text-profit-overview"
                  >
                    {formatCurrency(Math.abs(netProfit))}
                  </p>
                  <p className="text-[12px] text-[var(--bk-text-secondary)] mt-0.5 mb-3">
                    Net Profit{netProfit < 0 && <span className="text-[var(--bk-danger)] ml-1">— Loss</span>}
                  </p>
                  <BkProfitTrendChart points={trendPoints} />
                </BkPanel>
                <VatCard plTransactions={plTransactions} />
                <Irp6Card netProfit={netProfit} />
                <QuickActions />
              </div>
            </div>
          </>
        )}
      </div>
    </BookkeeperPreviewShell>
  );
}
