import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useDropzone } from "react-dropzone";
import {
  TrendingUp, TrendingDown, Wallet, BarChart3,
  Plus, Sparkles, Loader2, CloudUpload, ArrowRight, ExternalLink,
  CheckCircle2, AlertCircle, FileText, Calculator, Receipt,
  Download, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartTooltip,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate, getCategoryColor, formatDateInput } from "@/lib/utils";
import { useOrgFetch, useOrganisation } from "@/context/organisation-context";
import { OwnerFundsDecisionModal } from "@/components/owner-funds-decision-modal";
import { TransactionSummaryModal } from "@/components/transaction-summary-modal";
import { type TransactionWithCategory, type Category, type AIExtractionResult } from "@shared/schema";

// ─── Period helpers ────────────────────────────────────────────────────────────

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

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon: Icon, iconBg, iconColor, isLoading, testId,
}: {
  label: string; value: string; sub: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
  isLoading: boolean; testId: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#e4e7ec] px-5 py-4 flex items-start justify-between gap-3">
      {isLoading ? (
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      ) : (
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-[#667085] mb-1">{label}</p>
          <p
            className="text-[22px] font-bold text-[#101828] leading-tight tabular-nums"
            data-testid={testId}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {value}
          </p>
          <p className="text-[12px] text-[#667085] mt-0.5">{sub}</p>
        </div>
      )}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
      </div>
    </div>
  );
}

// ─── Kind badge ────────────────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: string | null | undefined }) {
  if (!kind || kind === 'expense' || kind === 'income') return null;
  const map: Record<string, { label: string; cls: string }> = {
    capital: { label: 'Capital', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    owner_loan: { label: 'Owner Loan', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    transfer: { label: 'Transfer', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
    tax: { label: 'Tax', cls: 'bg-red-50 text-red-600 border-red-200' },
  };
  const style = map[kind] ?? { label: kind, cls: 'bg-muted text-muted-foreground border-border' };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${style.cls}`}>
      {style.label}
    </span>
  );
}

// ─── Category chip ─────────────────────────────────────────────────────────────

function CategoryChip({ name }: { name: string }) {
  const color = getCategoryColor(name);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {name}
    </span>
  );
}

// ─── Entry controls ────────────────────────────────────────────────────────────

function EntryControls({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedOrgId } = useOrgFetch();

  const [nlText, setNlText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<AIExtractionResult | null>(null);
  const [formData, setFormData] = useState({
    vendor: '', amount: '', date: formatDateInput(new Date()),
    description: '', categoryId: '', type: 'expense' as 'expense' | 'income',
    taxCode: 'standard' as 'standard' | 'zero_rated' | 'exempt' | 'out_of_scope',
  });
  const [ownerFundsOpen, setOwnerFundsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [savedTx, setSavedTx] = useState<any>(null);

  const { data: categories } = useQuery<Category[]>({ queryKey: ['/api/categories'] });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) setFile(acceptedFiles[0]);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'], 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      if (file) fd.append('file', file);
      if (nlText) fd.append('naturalLanguage', nlText);
      const res = await fetch('/api/ai/extract', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json() as Promise<AIExtractionResult>;
    },
    onSuccess: (data) => {
      setExtractedData(data);
      setFormData({
        vendor: data.vendor, amount: data.amount, date: data.date,
        description: data.description,
        categoryId: categories?.find(c => c.name === data.category)?.id?.toString() ?? '',
        type: data.type ?? 'expense', taxCode: data.taxCode ?? 'standard',
      });
      toast({ title: 'AI Processing Complete', description: `${Math.round(data.confidence * 100)}% confidence` });
    },
    onError: (e: Error) => toast({ title: 'Processing Failed', description: e.message, variant: 'destructive' }),
  });

  const saveMutation = useMutation({
    mutationFn: async (forceKind?: 'capital' | 'owner_loan' | 'expense') => {
      const fd = new FormData();
      if (file && extractedData) fd.append('receiptImage', file);
      const payload: any = {
        ...formData,
        categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
        aiProcessed: extractedData ? 1 : 0,
        aiConfidence: extractedData?.confidence ?? null,
        ...(selectedOrgId != null ? { organisationId: selectedOrgId } : {}),
      };
      if (forceKind) payload.forceKind = forceKind;
      fd.append('data', JSON.stringify(payload));
      const res = await fetch('/api/transactions', { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      if (data._requiresOwnerFundsDecision) { setOwnerFundsOpen(true); return; }
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions', selectedOrgId] });
      setSavedTx(data); setSummaryOpen(true);
      setFile(null); setNlText(''); setExtractedData(null);
      setFormData({ vendor: '', amount: '', date: formatDateInput(new Date()), description: '', categoryId: '', type: 'expense', taxCode: 'standard' });
      onSaved();
    },
    onError: (e: Error) => toast({ title: 'Save Failed', description: e.message, variant: 'destructive' }),
  });

  const isPending = processMutation.isPending || saveMutation.isPending;
  const canProcess = !!nlText.trim() || !!file;
  const canSave = !!(extractedData && formData.vendor && formData.amount && formData.date);

  const resetExtracted = () => {
    setExtractedData(null);
    setFormData({ vendor: '', amount: '', date: formatDateInput(new Date()), description: '', categoryId: '', type: 'expense', taxCode: 'standard' });
  };

  return (
    <>
      <div className="grid gap-5" style={{ gridTemplateColumns: '320px minmax(0,1fr)' }}>
        {/* Upload receipt */}
        <div
          {...getRootProps()}
          className={`bg-white rounded-xl border-2 border-dashed cursor-pointer transition-colors p-5 flex flex-col items-center justify-center gap-2 min-h-[120px] ${
            isDragActive ? 'border-primary bg-primary/5' : file ? 'border-primary bg-primary/5' : 'border-[#e4e7ec] hover:border-primary hover:bg-slate-50'
          }`}
          data-testid="dropzone-upload"
        >
          <input {...getInputProps()} />
          <CloudUpload className={`w-7 h-7 ${file ? 'text-primary' : 'text-[#667085]'}`} />
          <div className="text-center">
            <p className={`text-[13px] font-semibold ${file ? 'text-primary' : 'text-[#101828]'}`}>
              {file ? file.name : 'Upload receipt'}
            </p>
            {!file && (
              <>
                <p className="text-[11px] text-[#667085] mt-0.5">JPG, PNG, PDF up to 10MB</p>
                <p className="text-[11px] text-[#667085]">or drag and drop</p>
              </>
            )}
            {file && !extractedData && (
              <Button
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={e => { e.stopPropagation(); processMutation.mutate(); }}
                disabled={isPending}
                data-testid="button-process-ai"
              >
                {processMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                Process
              </Button>
            )}
          </div>
        </div>

        {/* Natural language entry */}
        <div className="bg-white rounded-xl border border-[#e4e7ec] p-5 flex flex-col justify-between min-h-[120px]">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <p className="text-[12px] font-semibold text-[#667085]">Describe your transaction</p>
            </div>
            <Input
              placeholder="e.g. Paid R1,500 to the plumber on the 3rd"
              value={nlText}
              onChange={e => setNlText(e.target.value)}
              className="text-[13px] border-[#e4e7ec] bg-slate-50"
              data-testid="input-natural-language"
              disabled={isPending}
              onKeyDown={e => {
                if (e.key === 'Enter' && nlText.trim() && !isPending) processMutation.mutate();
              }}
            />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Button
              className="flex-1 h-8 text-xs"
              onClick={() => processMutation.mutate()}
              disabled={!nlText.trim() || isPending}
              data-testid="button-process-ai"
            >
              {processMutation.isPending
                ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Processing…</>
                : <><Sparkles className="w-3 h-3 mr-1.5" />Process</>
              }
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
              <Link href="/upload" data-testid="link-full-upload">Full Form</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Extracted fields */}
      {extractedData && (
        <div className="bg-white rounded-xl border border-[#e4e7ec] p-5 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {extractedData.confidence >= 0.7
                ? <CheckCircle2 className="w-4 h-4 text-[#168a50]" />
                : <AlertCircle className="w-4 h-4 text-amber-500" />
              }
              <span className="text-[13px] font-semibold">
                AI extracted — {Math.round(extractedData.confidence * 100)}% confidence
              </span>
            </div>
            <button onClick={resetExtracted} className="text-[12px] text-muted-foreground hover:text-foreground">
              Clear
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <Label className="text-[11px] text-[#667085]">Vendor</Label>
              <Input value={formData.vendor} onChange={e => setFormData(p => ({ ...p, vendor: e.target.value }))} className="h-8 text-[13px] mt-1" data-testid="input-vendor" />
            </div>
            <div>
              <Label className="text-[11px] text-[#667085]">Amount</Label>
              <Input value={formData.amount} onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))} className="h-8 text-[13px] mt-1" data-testid="input-amount" />
            </div>
            <div>
              <Label className="text-[11px] text-[#667085]">Date</Label>
              <Input type="date" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} className="h-8 text-[13px] mt-1" data-testid="input-date" />
            </div>
            <div>
              <Label className="text-[11px] text-[#667085]">Type</Label>
              <Select value={formData.type} onValueChange={v => setFormData(p => ({ ...p, type: v as 'expense' | 'income' }))}>
                <SelectTrigger className="h-8 text-[13px] mt-1" data-testid="select-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!canSave || isPending} className="w-full h-8" data-testid="button-save-transaction">
            {saveMutation.isPending ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : null}
            Save Transaction
          </Button>
        </div>
      )}

      <OwnerFundsDecisionModal
        open={ownerFundsOpen}
        onClose={() => setOwnerFundsOpen(false)}
        onDecide={(decision) => { setOwnerFundsOpen(false); saveMutation.mutate(decision); }}
      />
      <TransactionSummaryModal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        transaction={savedTx}
      />
    </>
  );
}

// ─── Recent transactions table ─────────────────────────────────────────────────

type TxTab = 'all' | 'expenses' | 'income' | 'owner_funds' | 'tax';
const TX_TABS: { key: TxTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'income', label: 'Income' },
  { key: 'owner_funds', label: 'Owner Funds' },
  { key: 'tax', label: 'Tax' },
];

function RecentTransactions({
  transactions, isLoading,
}: {
  transactions: TransactionWithCategory[]; isLoading: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TxTab>('all');
  const LIMIT = 8;

  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'expenses':    return transactions.filter(t => t.type === 'expense' && !['capital', 'owner_loan', 'tax', 'transfer'].includes(t.kind ?? ''));
      case 'income':      return transactions.filter(t => t.type === 'income' && !['capital', 'owner_loan', 'tax', 'transfer'].includes(t.kind ?? ''));
      case 'owner_funds': return transactions.filter(t => t.kind === 'capital' || t.kind === 'owner_loan' || t.kind === 'transfer');
      case 'tax':         return transactions.filter(t => t.kind === 'tax');
      default:            return transactions;
    }
  }, [activeTab, transactions]);

  const displayed = filtered.slice(0, LIMIT);

  return (
    <div className="bg-white rounded-xl border border-[#e4e7ec] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#f2f4f7]">
        <div>
          <h2 className="text-[15px] font-semibold text-[#101828]">Recent Transactions</h2>
        </div>
        <div className="flex items-center gap-4">
          {/* Filter tabs */}
          <div className="hidden sm:flex items-center gap-0.5 flex-nowrap">
            {TX_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                data-testid={`tab-txn-${t.key}`}
                className={`px-2 py-1 text-[12px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === t.key
                    ? 'bg-[#f0f4ff] text-primary'
                    : 'text-[#667085] hover:text-[#101828]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Link href="/ledger" data-testid="link-view-all-transactions"
            className="flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f9fafb] hover:bg-[#f9fafb]">
                  <TableHead className="text-[11px] font-semibold text-[#667085] uppercase tracking-wide pl-5 py-2.5">Date</TableHead>
                  <TableHead className="text-[11px] font-semibold text-[#667085] uppercase tracking-wide py-2.5">Description</TableHead>
                  <TableHead className="text-[11px] font-semibold text-[#667085] uppercase tracking-wide py-2.5 hidden md:table-cell">Vendor</TableHead>
                  <TableHead className="text-[11px] font-semibold text-[#667085] uppercase tracking-wide py-2.5 hidden sm:table-cell">Category</TableHead>
                  <TableHead className="text-[11px] font-semibold text-[#667085] uppercase tracking-wide py-2.5 hidden lg:table-cell">Type</TableHead>
                  <TableHead className="text-[11px] font-semibold text-[#667085] uppercase tracking-wide py-2.5 hidden lg:table-cell">Kind</TableHead>
                  <TableHead className="text-[11px] font-semibold text-[#667085] uppercase tracking-wide py-2.5 text-right pr-5">Amount</TableHead>
                  <TableHead className="text-[11px] font-semibold text-[#667085] uppercase tracking-wide py-2.5 hidden md:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="py-8">
                      <div className="flex flex-col items-center justify-center text-center gap-2">
                        <Receipt className="w-6 h-6 text-[#d0d5dd]" />
                        <p className="text-[13px] font-medium text-[#101828]">No transactions in this period</p>
                        <p className="text-[12px] text-[#667085]">Use the entry controls above to add your first transaction</p>
                        <Button size="sm" className="mt-1 h-7 text-[12px]" asChild>
                          <Link href="/upload" data-testid="link-empty-add-transaction">
                            <Plus className="w-3 h-3 mr-1" />Add Transaction
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {displayed.map(tx => {
                  const isOwnerFunds = ['capital', 'owner_loan', 'transfer'].includes(tx.kind ?? '');
                  const isTax = tx.kind === 'tax';
                  const amount = parseFloat(tx.amount);
                  const isInflow = tx.type === 'income';

                  return (
                    <TableRow
                      key={tx.id}
                      className="cursor-pointer hover:bg-[#f9fafb] transition-colors border-b border-[#f2f4f7] last:border-0"
                      data-testid={`row-transaction-${tx.id}`}
                    >
                      <TableCell className="pl-5 py-3.5 text-[12px] text-[#667085] whitespace-nowrap">
                        <Link href={`/transactions/${tx.id}`} className="block">{formatDate(tx.date)}</Link>
                      </TableCell>
                      <TableCell className="py-3.5 max-w-[200px]">
                        <Link href={`/transactions/${tx.id}`} className="block">
                          <div className="text-[13px] font-medium text-[#101828] truncate">
                            {tx.description || tx.vendor || '—'}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="py-3.5 hidden md:table-cell">
                        <Link href={`/transactions/${tx.id}`} className="block">
                          <span className="text-[12px] text-[#667085] truncate">{tx.vendor || '—'}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="py-3.5 hidden sm:table-cell">
                        <Link href={`/transactions/${tx.id}`} className="block">
                          {tx.category
                            ? <CategoryChip name={tx.category.name} />
                            : <span className="text-[12px] text-[#d0d5dd]">—</span>
                          }
                        </Link>
                      </TableCell>
                      <TableCell className="py-3.5 hidden lg:table-cell">
                        <Link href={`/transactions/${tx.id}`} className="block">
                          <span className="text-[12px] text-[#667085]">{tx.type}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="py-3.5 hidden lg:table-cell">
                        <Link href={`/transactions/${tx.id}`} className="block">
                          <KindBadge kind={tx.kind} />
                          {!isOwnerFunds && !isTax && (
                            <span className="text-[12px] text-[#667085]">{tx.kind || tx.type}</span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="py-3.5 text-right pr-5">
                        <Link href={`/transactions/${tx.id}`} className="block">
                          <span
                            className="text-[13px] font-semibold tabular-nums"
                            style={{
                              fontVariantNumeric: 'tabular-nums',
                              color: isOwnerFunds || isTax
                                ? '#667085'
                                : isInflow ? '#168a50' : '#d92d20',
                            }}
                          >
                            {isInflow ? '+' : '-'}{formatCurrency(Math.abs(amount))}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="py-3.5 hidden md:table-cell">
                        <Link href={`/transactions/${tx.id}`} className="block">
                          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded bg-[#f2f4f7] text-[#344054]">
                            Posted
                          </span>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#f2f4f7] bg-[#f9fafb]">
            <p className="text-[12px] text-[#667085]">
              {filtered.length === 0
                ? 'No transactions'
                : `Showing 1 to ${displayed.length} of ${filtered.length} transaction${filtered.length !== 1 ? 's' : ''}`}
            </p>
            <Button variant="outline" size="sm" className="h-7 text-[12px] border-[#e4e7ec]" onClick={() => window.location.href = '/api/transactions/export/csv'}>
              <Download className="w-3 h-3 mr-1.5" />Export CSV
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Profit overview card ──────────────────────────────────────────────────────

function ProfitOverview({
  netProfit, plTransactions, period, onPeriodChange,
}: {
  netProfit: number;
  plTransactions: TransactionWithCategory[];
  period: Period;
  onPeriodChange: (p: Period) => void;
}) {
  const trendData = useMemo(() => {
    if (plTransactions.length === 0) return [];
    const sorted = [...plTransactions].sort((a, b) => a.date.localeCompare(b.date));
    let cum = 0;
    const byDate = new Map<string, number>();
    sorted.forEach(t => {
      cum += t.type === 'income' ? parseFloat(t.amount) : -parseFloat(t.amount);
      byDate.set(t.date, cum);
    });
    return Array.from(byDate.entries()).map(([date, value]) => ({
      date: date.slice(5).replace('-', '/'),
      value,
    }));
  }, [plTransactions]);

  const isPositive = netProfit >= 0;

  return (
    <div className="bg-white rounded-xl border border-[#e4e7ec] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-[#101828]">Profit Overview</h3>
        <Select value={period} onValueChange={v => onPeriodChange(v as Period)}>
          <SelectTrigger className="h-7 text-[11px] w-36 border-[#e4e7ec]" data-testid="select-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <SelectItem key={p} value={p} className="text-[12px]">{PERIOD_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-1">
        <p
          className="text-[28px] font-bold leading-tight"
          data-testid="text-net-amount"
          style={{ color: isPositive ? '#168a50' : '#d92d20', fontVariantNumeric: 'tabular-nums' }}
        >
          {formatCurrency(Math.abs(netProfit))}
        </p>
        <p className="text-[12px] text-[#667085] mt-0.5">
          Net Profit
          {netProfit < 0 && <span className="text-[#d92d20] ml-1">— Loss</span>}
        </p>
      </div>

      {trendData.length >= 2 ? (
        <div className="mt-3 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isPositive ? '#168a50' : '#d92d20'} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={isPositive ? '#168a50' : '#d92d20'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={isPositive ? '#168a50' : '#d92d20'}
                strokeWidth={1.5}
                fill="url(#profitGrad)"
                dot={false}
              />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <RechartTooltip
                formatter={(v: number) => [formatCurrency(v), 'Cumulative Profit']}
                contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #e4e7ec' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-3 h-16 flex items-center justify-center">
          <p className="text-[12px] text-[#d0d5dd]">Add transactions to see trend</p>
        </div>
      )}
    </div>
  );
}

// ─── VAT card ─────────────────────────────────────────────────────────────────

function VatCard({ plTransactions }: { plTransactions: TransactionWithCategory[] }) {
  const { data: returns } = useQuery<any[]>({ queryKey: ['/api/vat/returns'] });
  const latest = returns && returns.length > 0 ? returns[returns.length - 1] : null;

  // Live calculated position from transactions
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

  const periodLabel = latest ? latest.periodKey : 'Current Period';
  const status = latest ? latest.status : null;

  return (
    <div className="bg-white rounded-xl border border-[#e4e7ec] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <div>
            <h3 className="text-[13px] font-semibold text-[#101828]">VAT201 ({periodLabel})</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 capitalize">
              {status}
            </span>
          )}
          <Link href="/vat201" className="text-[12px] font-medium text-primary hover:underline flex items-center gap-0.5" data-testid="link-vat201">
            View <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {latest ? (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[#667085]">VAT Collected</span>
            <span className="text-[13px] font-medium text-[#101828] tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(parseFloat(latest.outputVat) / 100)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[#667085]">VAT Claimable</span>
            <span className="text-[13px] font-medium text-[#101828] tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(parseFloat(latest.inputVat) / 100)}
            </span>
          </div>
          <div className="border-t border-[#f2f4f7] pt-2 flex justify-between items-center">
            <span className="text-[12px] font-medium text-[#344054]">
              {parseFloat(latest.netVat) >= 0 ? 'VAT Payable' : 'VAT Refund'}
            </span>
            <span
              className="text-[14px] font-bold tabular-nums"
              style={{
                fontVariantNumeric: 'tabular-nums',
                color: parseFloat(latest.netVat) >= 0 ? '#d92d20' : '#168a50',
              }}
            >
              {formatCurrency(Math.abs(parseFloat(latest.netVat)) / 100)}
            </span>
          </div>
        </div>
      ) : vatCalc.collected > 0 || vatCalc.claimable > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] text-[#667085] mb-2">Estimated from current transactions</p>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[#667085]">VAT Collected</span>
            <span className="text-[13px] font-medium text-[#101828]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(vatCalc.collected)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[#667085]">VAT Claimable</span>
            <span className="text-[13px] font-medium text-[#101828]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(vatCalc.claimable)}
            </span>
          </div>
          <div className="border-t border-[#f2f4f7] pt-2 flex justify-between items-center">
            <span className="text-[12px] font-medium text-[#344054]">
              {vatCalc.payable >= 0 ? 'VAT Payable' : 'VAT Refund'}
            </span>
            <span
              className="text-[14px] font-bold"
              style={{ fontVariantNumeric: 'tabular-nums', color: vatCalc.payable >= 0 ? '#d92d20' : '#168a50' }}
            >
              {formatCurrency(Math.abs(vatCalc.payable))}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-[#667085]">No returns or transactions yet.</p>
      )}

      <Link href="/vat201">
        <Button variant="outline" size="sm" className="w-full mt-4 h-8 text-[12px] border-[#e4e7ec]">
          <FileText className="w-3 h-3 mr-1.5" />View VAT201
        </Button>
      </Link>
    </div>
  );
}

// ─── IRP6 card ─────────────────────────────────────────────────────────────────

function Irp6Card({ netProfit }: { netProfit: number }) {
  const { data: estimates } = useQuery<any[]>({ queryKey: ['/api/irp6/estimates'] });
  const latest = estimates && estimates.length > 0 ? estimates[estimates.length - 1] : null;

  const estTaxableIncome = Math.max(0, netProfit);
  const estProvTax = estTaxableIncome * 0.28;

  return (
    <div className="bg-white rounded-xl border border-[#e4e7ec] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-[#101828]">
            {latest ? `IRP6 Estimate (${latest.yearOfAssessment}/${latest.half === 1 ? '01' : '03'})` : 'IRP6 Provisional'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {latest && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
              {latest.status ?? 'Draft'}
            </span>
          )}
          <Link href="/irp6" className="text-[12px] font-medium text-primary hover:underline flex items-center gap-0.5" data-testid="link-irp6">
            View <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {latest ? (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[#667085]">Taxable Income</span>
            <span className="text-[13px] font-medium text-[#101828]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(parseFloat(latest.taxableIncome) / 100)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[#667085]">Provisional Tax (Next)</span>
            <span className="text-[13px] font-semibold text-[#d92d20]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(parseFloat(latest.estimatedTax) / 100)}
            </span>
          </div>
        </div>
      ) : estTaxableIncome > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] text-[#667085] mb-2">Estimated from current P&L (28% effective rate)</p>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[#667085]">Taxable Income</span>
            <span className="text-[13px] font-medium text-[#101828]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(estTaxableIncome)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] text-[#667085]">Provisional Tax (Est.)</span>
            <span className="text-[13px] font-semibold text-[#d92d20]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(estProvTax)}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-[#667085]">No estimates saved. Add income transactions to see an estimate.</p>
      )}

      <Link href="/irp6">
        <Button variant="outline" size="sm" className="w-full mt-4 h-8 text-[12px] border-[#e4e7ec]">
          <Calculator className="w-3 h-3 mr-1.5" />View IRP6
        </Button>
      </Link>
    </div>
  );
}

// ─── Quick actions ─────────────────────────────────────────────────────────────

function QuickActions() {
  const actions = [
    { label: 'Add Transaction', icon: Plus, href: '/upload', testId: 'link-quick-add-transaction' },
    { label: 'Upload Receipt', icon: CloudUpload, href: '/upload', testId: 'link-quick-upload-receipt' },
    { label: 'New Report', icon: BarChart3, href: '/reports', testId: 'link-quick-reports' },
  ];
  return (
    <div className="bg-white rounded-xl border border-[#e4e7ec] p-4">
      <h3 className="text-[13px] font-semibold text-[#101828] mb-3">Quick Actions</h3>
      <div className="grid grid-cols-3 gap-2">
        {actions.map(a => (
          <Link
            key={a.label}
            href={a.href}
            data-testid={a.testId}
            className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border border-[#e4e7ec] hover:border-primary hover:bg-[#f0f4ff] transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#f0f4ff] flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <a.icon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-[11px] font-medium text-[#344054] text-center leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const { selectedOrg, selectedOrgId } = useOrganisation();
  const { orgUrl } = useOrgFetch();
  const [period, setPeriod] = useState<Period>('this_month');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: transactions = [], isLoading } = useQuery<TransactionWithCategory[]>({
    queryKey: ['/api/transactions', selectedOrgId],
    queryFn: () =>
      fetch(orgUrl('/api/transactions'), { credentials: 'include' }).then(r => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      }),
  });

  const periodTransactions = useMemo(
    () => filterByPeriod(transactions, period),
    [transactions, period, refreshKey],
  );

  // P&L only (exclude owner funds / tax / transfers)
  const plTransactions = useMemo(
    () => periodTransactions.filter(t => !['capital', 'owner_loan', 'tax', 'transfer'].includes(t.kind ?? '')),
    [periodTransactions],
  );
  const incomeTransactions = plTransactions.filter(t => t.type === 'income');
  const expenseTransactions = plTransactions.filter(t => t.type === 'expense');
  const totalIncome = incomeTransactions.reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalExpenses = expenseTransactions.reduce((s, t) => s + parseFloat(t.amount), 0);
  const netProfit = totalIncome - totalExpenses;

  // Cash balance = net of all transactions (including owner funds)
  const cashBalance = useMemo(() => {
    return periodTransactions.reduce((s, t) => {
      return s + (t.type === 'income' ? parseFloat(t.amount) : -parseFloat(t.amount));
    }, 0);
  }, [periodTransactions]);

  const firstName = user?.firstName || null;
  const greeting = getGreeting();
  const orgName = selectedOrg?.name ?? null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[26px] font-bold text-[#101828] leading-tight" data-testid="text-dashboard-title">
            {greeting}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-[14px] text-[#667085] mt-0.5">
            Here's what's happening with {orgName ?? 'your personal workspace'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Calendar className="w-4 h-4 text-[#667085]" />
          <Select value={period} onValueChange={v => setPeriod(v as Period)}>
            <SelectTrigger className="h-9 text-[13px] w-40 border-[#e4e7ec] bg-white" data-testid="select-period">
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

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Revenue" icon={TrendingUp} iconBg="bg-[#eaf8f0]" iconColor="text-[#168a50]"
          value={formatCurrency(totalIncome)}
          sub={`${incomeTransactions.length} transaction${incomeTransactions.length !== 1 ? 's' : ''}`}
          isLoading={isLoading} testId="text-total-income"
        />
        <MetricCard
          label="Expenses" icon={TrendingDown} iconBg="bg-[#fef0f0]" iconColor="text-[#d92d20]"
          value={formatCurrency(totalExpenses)}
          sub={`${expenseTransactions.length} transaction${expenseTransactions.length !== 1 ? 's' : ''}`}
          isLoading={isLoading} testId="text-total-expenses"
        />
        <MetricCard
          label="Net Profit" icon={BarChart3} iconBg="bg-[#f0f4ff]" iconColor="text-primary"
          value={formatCurrency(Math.abs(netProfit))}
          sub={netProfit >= 0 ? 'Positive' : 'Negative — Loss'}
          isLoading={isLoading} testId="text-net-amount"
        />
        <MetricCard
          label="Transactions" icon={Wallet} iconBg="bg-[#f5f3ff]" iconColor="text-violet-600"
          value={String(periodTransactions.length)}
          sub="Total records"
          isLoading={isLoading} testId="text-total-transactions"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6" style={{ gridTemplateColumns: 'minmax(0, 1fr) 340px' }}>
        {/* Main column */}
        <div className="space-y-5 min-w-0">
          <EntryControls onSaved={() => setRefreshKey(k => k + 1)} />
          <RecentTransactions transactions={periodTransactions} isLoading={isLoading} />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <ProfitOverview
            netProfit={netProfit}
            plTransactions={plTransactions}
            period={period}
            onPeriodChange={setPeriod}
          />
          <VatCard plTransactions={plTransactions} />
          <Irp6Card netProfit={netProfit} />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
