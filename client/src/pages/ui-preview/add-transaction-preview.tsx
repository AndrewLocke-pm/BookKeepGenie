import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import {
  CloudUpload, Sparkles, Loader2, CheckCircle2, AlertCircle, AlertTriangle, X,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatDateInput } from '@/lib/utils';
import { useOrgFetch } from '@/context/organisation-context';
import { BookkeeperPreviewShell } from '@/components/bookkeeper/BookkeeperPreviewShell';
import { BkPanel } from '@/components/bookkeeper/ui';
import { BkOwnerFundsModal } from '@/components/bookkeeper/BkOwnerFundsModal';
import { type Category, type AIExtractionResult } from '@shared/schema';

const TAX_CODE_LABELS: Record<string, string> = {
  standard: 'Standard rated (15%)',
  zero_rated: 'Zero rated (0%)',
  exempt: 'Exempt',
  out_of_scope: 'Out of scope',
};

function treatmentSummary(type: 'expense' | 'income', taxCode: string): string {
  const vat =
    taxCode === 'standard'
      ? 'VAT at 15% will be calculated on this amount.'
      : taxCode === 'zero_rated'
        ? 'Zero rated — included in VAT201 at 0%.'
        : taxCode === 'exempt'
          ? 'Exempt — no VAT applies.'
          : 'Out of scope — excluded from VAT201.';
  return type === 'income'
    ? `Recorded as revenue and included in profit. ${vat}`
    : `Recorded as an expense and reduces profit. ${vat}`;
}

export default function AddTransactionPreview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedOrgId } = useOrgFetch();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [naturalLanguage, setNaturalLanguage] = useState('');
  const [extractedData, setExtractedData] = useState<AIExtractionResult | null>(null);
  const [ownerFundsOpen, setOwnerFundsOpen] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [formData, setFormData] = useState({
    vendor: '', amount: '', date: formatDateInput(new Date()),
    description: '', categoryId: '',
    type: 'expense' as 'expense' | 'income',
    taxCode: 'standard' as 'standard' | 'zero_rated' | 'exempt' | 'out_of_scope',
  });

  const { data: categories } = useQuery<Category[]>({ queryKey: ['/api/categories'] });

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    setFile(f);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
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
      if (naturalLanguage) fd.append('naturalLanguage', naturalLanguage);
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
      toast({ title: 'AI Processing Complete', description: `Extracted with ${Math.round(data.confidence * 100)}% confidence` });
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
      if (data._requiresOwnerFundsDecision) {
        setOwnerFundsOpen(true);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions', selectedOrgId] });
      setSavedOk(true);
      setFile(null); setPreview(null); setNaturalLanguage(''); setExtractedData(null);
      setFormData({ vendor: '', amount: '', date: formatDateInput(new Date()), description: '', categoryId: '', type: 'expense', taxCode: 'standard' });
      toast({ title: 'Transaction Saved', description: 'Your transaction has been recorded.' });
    },
    onError: (e: Error) => toast({ title: 'Save Failed', description: e.message, variant: 'destructive' }),
  });

  const isPending = processMutation.isPending || saveMutation.isPending;
  const canProcess = !!naturalLanguage.trim() || !!file;
  const canSave = !!(formData.vendor && formData.amount && formData.date);

  const summary = useMemo(
    () => treatmentSummary(formData.type, formData.taxCode),
    [formData.type, formData.taxCode],
  );

  const confidencePct = extractedData ? Math.round(extractedData.confidence * 100) : null;

  return (
    <BookkeeperPreviewShell activePage="Add Transaction">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-[var(--bk-text-primary)] leading-tight" data-testid="text-page-title">
            Add Transaction
          </h1>
          <p className="text-[14px] text-[var(--bk-text-secondary)] mt-0.5">
            Upload a receipt or describe the transaction — AI extracts the details for review.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left: input */}
          <div className="space-y-5">
            <BkPanel className="p-5">
              <h3 className="text-[14px] font-bold text-[var(--bk-text-primary)] mb-1">Upload Receipt</h3>
              <p className="text-[13px] text-[var(--bk-text-secondary)] mb-4">Drop a receipt, invoice image, or PDF</p>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive || file
                    ? 'border-[var(--bk-primary)] bg-[var(--bk-primary-subtle)]/40'
                    : 'border-[var(--bk-border-strong)] hover:border-[var(--bk-primary)] hover:bg-[var(--bk-primary-subtle)]/20'
                }`}
                data-testid="dropzone-upload"
              >
                <input {...getInputProps()} />
                <CloudUpload className={`w-10 h-10 mx-auto mb-3 ${file ? 'text-[var(--bk-primary)]' : 'text-[var(--bk-text-muted)]'}`} />
                <p className="text-[14px] font-medium text-[var(--bk-text-primary)]">
                  {file ? file.name : 'Drop a file here, or click to upload'}
                </p>
                {!file && <p className="text-[12px] text-[var(--bk-text-muted)] mt-1">PNG, JPG, GIF, PDF up to 10MB</p>}
              </div>
              {file && (
                <div className="mt-3 flex items-center justify-between gap-2">
                  {preview ? (
                    <img src={preview} alt="Receipt preview" className="max-h-40 rounded-md border border-[var(--bk-border)]" data-testid="img-receipt-preview" />
                  ) : (
                    <span className="text-[13px] text-[var(--bk-text-secondary)]">{(file.size / 1024).toFixed(1)} KB</span>
                  )}
                  <button
                    onClick={() => { setFile(null); setPreview(null); }}
                    className="text-[var(--bk-text-muted)] hover:text-[var(--bk-danger)] transition-colors self-start"
                    aria-label="Remove file"
                    data-testid="button-remove-file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </BkPanel>

            <BkPanel className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-[var(--bk-primary)]" />
                <h3 className="text-[14px] font-bold text-[var(--bk-text-primary)]">Describe the Transaction</h3>
              </div>
              <p className="text-[13px] text-[var(--bk-text-secondary)] mb-3">
                e.g. "Paid R1,500 to the plumber on the 3rd"
              </p>
              <Textarea
                placeholder="Describe this transaction..."
                value={naturalLanguage}
                onChange={e => setNaturalLanguage(e.target.value)}
                className="min-h-[100px] text-[14px] border-[var(--bk-border)]"
                data-testid="input-natural-language"
                disabled={isPending}
              />
              <button
                onClick={() => processMutation.mutate()}
                disabled={!canProcess || isPending}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-[var(--bk-primary)] hover:bg-[var(--bk-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[14px] font-medium shadow-sm transition-colors"
                data-testid="button-process-ai"
              >
                {processMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Processing with AI…</>
                  : <><Sparkles className="w-4 h-4" />Process with AI</>}
              </button>
            </BkPanel>
          </div>

          {/* Right: review form */}
          <BkPanel className="p-5">
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <h3 className="text-[14px] font-bold text-[var(--bk-text-primary)]">Transaction Details</h3>
              {confidencePct != null && (
                <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2 py-0.5 rounded-full ${
                  confidencePct >= 70
                    ? 'bg-[var(--bk-success-subtle)] text-[var(--bk-success)]'
                    : 'bg-[var(--bk-warning-subtle)] text-[var(--bk-warning)]'
                }`} data-testid="badge-confidence">
                  {confidencePct >= 70 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {confidencePct}% confidence
                </span>
              )}
            </div>
            <p className="text-[13px] text-[var(--bk-text-secondary)] mb-4">Review and edit the extracted information</p>

            {extractedData && extractedData.confidence < 0.6 && (
              <div className="mb-4 flex items-start gap-2 p-3 rounded-md bg-[var(--bk-warning-subtle)] border border-[var(--bk-warning)]/20 text-[13px] text-[var(--bk-warning)]" data-testid="badge-low-confidence-upload">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                Low confidence — please review the category and amounts carefully.
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-[12px] text-[var(--bk-text-secondary)]">Vendor *</Label>
                  <Input value={formData.vendor} onChange={e => setFormData(p => ({ ...p, vendor: e.target.value }))} placeholder="Company or person name" className="mt-1 text-[14px] border-[var(--bk-border)]" data-testid="input-vendor" />
                </div>
                <div>
                  <Label className="text-[12px] text-[var(--bk-text-secondary)]">Amount (R) *</Label>
                  <Input value={formData.amount} onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" className="mt-1 text-[14px] border-[var(--bk-border)] tabular-nums" data-testid="input-amount" />
                </div>
                <div>
                  <Label className="text-[12px] text-[var(--bk-text-secondary)]">Date *</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} className="mt-1 text-[14px] border-[var(--bk-border)]" data-testid="input-date" />
                </div>
                <div>
                  <Label className="text-[12px] text-[var(--bk-text-secondary)]">Type</Label>
                  <Select value={formData.type} onValueChange={v => setFormData(p => ({ ...p, type: v as 'expense' | 'income' }))}>
                    <SelectTrigger className="mt-1 text-[14px] border-[var(--bk-border)]" data-testid="select-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[12px] text-[var(--bk-text-secondary)]">Category</Label>
                  <Select value={formData.categoryId} onValueChange={v => setFormData(p => ({ ...p, categoryId: v }))}>
                    <SelectTrigger className="mt-1 text-[14px] border-[var(--bk-border)]" data-testid="select-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories ?? []).map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[12px] text-[var(--bk-text-secondary)]">VAT Tax Code</Label>
                  <Select value={formData.taxCode} onValueChange={v => setFormData(p => ({ ...p, taxCode: v as typeof formData.taxCode }))}>
                    <SelectTrigger className="mt-1 text-[14px] border-[var(--bk-border)]" data-testid="select-tax-code"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TAX_CODE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-[12px] text-[var(--bk-text-secondary)]">Description</Label>
                <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="What was this for?" className="mt-1 min-h-[70px] text-[14px] border-[var(--bk-border)]" data-testid="input-description" />
              </div>

              {/* Accounting treatment summary */}
              <div className="p-3 rounded-md bg-[var(--bk-surface-subtle)] border border-[var(--bk-border)] text-[13px] text-[var(--bk-text-secondary)]" data-testid="text-treatment-summary">
                <span className="font-semibold text-[var(--bk-text-primary)]">Accounting treatment: </span>
                {summary}
              </div>

              <button
                onClick={() => saveMutation.mutate(undefined)}
                disabled={!canSave || isPending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-[var(--bk-primary)] hover:bg-[var(--bk-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[14px] font-medium shadow-sm transition-colors"
                data-testid="button-save-transaction"
              >
                {saveMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Save Transaction'}
              </button>

              {savedOk && (
                <div className="flex items-center gap-2 text-[13px] text-[var(--bk-success)]" data-testid="text-save-success">
                  <CheckCircle2 className="w-4 h-4" />Transaction saved successfully.
                </div>
              )}
            </div>
          </BkPanel>
        </div>
      </div>

      <BkOwnerFundsModal
        open={ownerFundsOpen}
        onClose={() => setOwnerFundsOpen(false)}
        onConfirm={decision => saveMutation.mutate(decision)}
        transactionDetails={{
          vendor: formData.vendor || undefined,
          description: formData.description || undefined,
          amount: formData.amount || undefined,
        }}
      />
    </BookkeeperPreviewShell>
  );
}
