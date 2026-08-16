import { formatCurrency } from '@/lib/utils';

// ─── Metric card ──────────────────────────────────────────────────────────────

export function BkMetricCard({
  title, value, sub, valueColor, isLoading, testId,
}: {
  title: string;
  value: string;
  sub?: string;
  subTone?: 'success' | 'danger' | 'neutral';
  valueColor?: string;
  isLoading?: boolean;
  testId?: string;
}) {
  return (
    <div className="bg-[var(--bk-surface)] border border-[var(--bk-border)] p-4 sm:p-6 rounded-xl shadow-sm flex flex-col">
      <div className="text-[13px] font-medium text-[var(--bk-text-secondary)] mb-2">{title}</div>
      {isLoading ? (
        <div className="h-8 w-28 rounded bg-[var(--bk-surface-subtle)] animate-pulse mb-3" />
      ) : (
        <div
          className="text-[22px] sm:text-[28px] font-bold tabular-nums mb-3"
          style={{ color: valueColor || 'var(--bk-text-primary)' }}
          data-testid={testId}
        >
          {value}
        </div>
      )}
      <div className="mt-auto">
        <span className="text-[13px] text-[var(--bk-text-secondary)]">{sub ?? ''}</span>
      </div>
    </div>
  );
}

// ─── Kind badge (production kinds only) ───────────────────────────────────────

export function BkKindBadge({ kind, type }: { kind: string | null | undefined; type: string }) {
  const effective = kind && kind !== 'income' && kind !== 'expense' ? kind : type;
  if (effective === 'capital' || effective === 'owner_loan')
    return <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-[var(--bk-warning-subtle)] text-[var(--bk-warning)] border border-[var(--bk-warning)]/20 whitespace-nowrap">Owner Funds</span>;
  if (effective === 'tax')
    return <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-[var(--bk-violet-subtle)] text-[var(--bk-violet)] border border-[var(--bk-violet)]/20 whitespace-nowrap">Tax</span>;
  if (effective === 'transfer')
    return <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">Transfer</span>;
  if (effective === 'income')
    return <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-[var(--bk-success-subtle)] text-[var(--bk-success)] border border-[var(--bk-success)]/20 whitespace-nowrap">Income</span>;
  return <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-[var(--bk-danger-subtle)] text-[var(--bk-danger)] border border-[var(--bk-danger)]/20 whitespace-nowrap">Expense</span>;
}

// ─── Amount display ───────────────────────────────────────────────────────────

export function BkAmount({ amount, kind, type }: { amount: string | number; kind: string | null | undefined; type: string }) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const formatted = formatCurrency(Math.abs(num));
  if (kind === 'capital' || kind === 'owner_loan')
    return <span className="text-[var(--bk-warning)]">{formatted}</span>;
  if (kind === 'tax')
    return <span className="text-[var(--bk-violet)]">{type === 'expense' ? '-' : ''}{formatted}</span>;
  if (kind === 'transfer')
    return <span className="text-slate-600">{type === 'expense' ? '-' : ''}{formatted}</span>;
  const isIncome = type === 'income';
  return (
    <span className={isIncome ? 'text-[var(--bk-success)]' : 'text-[var(--bk-danger)]'}>
      {isIncome ? '' : '-'}{formatted}
    </span>
  );
}

// ─── Profit trend chart (real data, {period, profit}[] view-model) ───────────

export interface ProfitTrendPoint {
  period: string; // e.g. "Apr"
  profit: number;
}

export function BkProfitTrendChart({ points }: { points: ProfitTrendPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="h-[80px] flex items-center justify-center">
        <p className="text-[12px] text-[var(--bk-text-muted)]">Add transactions to see your profit trend</p>
      </div>
    );
  }

  const W = 280, H = 80, PAD = 6;
  const values = points.map(p => p.profit);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => PAD + (1 - (v - min) / range) * (H - PAD * 2);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.profit).toFixed(1)}`).join(' ');
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  const last = points[points.length - 1];
  const positive = last.profit >= 0;
  const color = positive ? 'var(--bk-success)' : 'var(--bk-danger)';

  return (
    <div>
      <div className="h-[80px] w-full relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="bkProfitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#bkProfitGradient)" />
          <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={x(points.length - 1)} cy={y(last.profit)} r="4" fill={color} />
        </svg>
      </div>
      <div className="flex justify-between text-[12px] text-[var(--bk-text-muted)] font-medium mt-2 px-1">
        {points.map((p, i) => (
          <span key={`${p.period}-${i}`}>{p.period}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Card panel ───────────────────────────────────────────────────────────────

export function BkPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[var(--bk-surface)] border border-[var(--bk-border)] rounded-xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}
