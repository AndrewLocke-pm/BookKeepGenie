import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft, Pencil, Trash2, FileImage, Bot, Tag, AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useOrgFetch } from '@/context/organisation-context';
import type { TransactionWithCategory } from '@shared/schema';

const KIND_LABELS: Record<string, string> = {
  income: 'Income',
  expense: 'Expense',
  capital: 'Capital',
  owner_loan: 'Owner Loan',
  transfer: 'Transfer',
  tax: 'Tax',
};

const KIND_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  income: 'default',
  expense: 'destructive',
  capital: 'secondary',
  owner_loan: 'secondary',
  transfer: 'outline',
  tax: 'secondary',
};

const TAX_CODE_LABELS: Record<string, string> = {
  standard: 'Standard (15%)',
  zero_rated: 'Zero Rated (0%)',
  exempt: 'Exempt',
  out_of_scope: 'Out of Scope',
};

export default function TransactionDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedOrgId, orgUrl } = useOrgFetch();
  const [editOpen, setEditOpen] = useState(false);

  const id = parseInt(params.id ?? '0', 10);

  const { data: transaction, isLoading, error } = useQuery<TransactionWithCategory>({
    queryKey: ['/api/transactions', id, selectedOrgId],
    queryFn: () =>
      fetch(orgUrl(`/api/transactions/${id}`), { credentials: 'include' })
        .then(r => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json();
        }),
    enabled: !isNaN(id) && id > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiRequest('DELETE', orgUrl(`/api/transactions/${id}`)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      toast({ title: 'Transaction deleted' });
      setLocation('/ledger');
    },
    onError: () => toast({ title: 'Failed to delete transaction', variant: 'destructive' }),
  });

  if (isNaN(id) || id <= 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Invalid transaction ID.</p>
        <Link href="/ledger"><Button variant="outline">Back to Ledger</Button></Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Transaction not found.</p>
        <Link href="/ledger"><Button variant="outline">Back to Ledger</Button></Link>
      </div>
    );
  }

  const isInflow = transaction.direction === 'inflow';
  const amount = parseFloat(String(transaction.amount ?? 0));

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/ledger">
            <Button variant="ghost" size="icon" aria-label="Back to Ledger">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold leading-tight" data-testid="text-vendor">
              {transaction.vendor}
            </h1>
            <p className="text-sm text-muted-foreground">{formatDate(transaction.date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            data-testid="button-edit-transaction"
          >
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid="button-delete-transaction"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Amount hero */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Amount</p>
              <p
                className={`text-3xl font-bold ${isInflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
                data-testid="text-amount"
              >
                {isInflow ? '+' : '-'}{formatCurrency(Math.abs(amount))}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={KIND_VARIANTS[transaction.kind ?? 'expense'] ?? 'secondary'}>
                {KIND_LABELS[transaction.kind ?? 'expense'] ?? transaction.kind}
              </Badge>
              {transaction.category && (
                <Badge variant="outline">{transaction.category.name}</Badge>
              )}
              {transaction.aiProcessed === 1 && (
                <Badge variant="outline" className="gap-1">
                  <Bot className="w-3 h-3" />
                  AI Processed
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
          <TabsTrigger value="receipt" data-testid="tab-receipt">Receipt</TabsTrigger>
          <TabsTrigger value="ai" data-testid="tab-ai-classification">AI & Classification</TabsTrigger>
        </TabsList>

        {/* Details tab */}
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <DetailRow label="Vendor" value={transaction.vendor} testId="detail-vendor" />
                <DetailRow label="Date" value={formatDate(transaction.date)} testId="detail-date" />
                <DetailRow
                  label="Description"
                  value={transaction.description || '—'}
                  testId="detail-description"
                  className="sm:col-span-2"
                />
                <DetailRow
                  label="Category"
                  value={transaction.category?.name || 'Uncategorised'}
                  testId="detail-category"
                />
                <DetailRow
                  label="Transaction Type"
                  value={transaction.type}
                  testId="detail-type"
                />
                <DetailRow
                  label="Direction"
                  value={transaction.direction === 'inflow' ? 'Inflow (money in)' : 'Outflow (money out)'}
                  testId="detail-direction"
                />
                <DetailRow
                  label="Affects Profit & Loss"
                  value={transaction.affectsProfit ? 'Yes' : 'No — owner funds or transfer'}
                  testId="detail-affects-profit"
                />
                {transaction.notes && (
                  <DetailRow
                    label="Notes"
                    value={transaction.notes}
                    testId="detail-notes"
                    className="sm:col-span-2"
                  />
                )}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receipt tab */}
        <TabsContent value="receipt" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileImage className="w-4 h-4" />
                Receipt Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transaction.receiptUrl ? (
                <div className="flex flex-col gap-4">
                  <div className="rounded-md border overflow-hidden bg-muted/30 flex items-center justify-center min-h-48">
                    {transaction.receiptUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img
                        src={transaction.receiptUrl}
                        alt="Receipt"
                        className="max-w-full max-h-96 object-contain"
                        data-testid="img-receipt"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-10 text-center">
                        <FileImage className="w-10 h-10 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Receipt file attached</p>
                        <Button variant="outline" size="sm" asChild>
                          <a href={transaction.receiptUrl} target="_blank" rel="noopener noreferrer">
                            View Receipt
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate" data-testid="text-receipt-url">
                    {transaction.receiptUrl}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <FileImage className="w-10 h-10 text-muted-foreground" />
                  <p className="text-muted-foreground">No receipt attached to this transaction.</p>
                  <p className="text-sm text-muted-foreground">
                    Add a receipt by editing the transaction.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI & Classification tab */}
        <TabsContent value="ai" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="w-4 h-4" />
                AI Classification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <DetailRow
                  label="AI Processed"
                  value={transaction.aiProcessed === 1 ? 'Yes' : 'No — manually entered'}
                  testId="detail-ai-processed"
                />
                {transaction.aiConfidence != null && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      AI Confidence
                    </dt>
                    <dd className="text-sm font-medium" data-testid="detail-ai-confidence">
                      {Math.round(parseFloat(String(transaction.aiConfidence)) * 100)}%
                    </dd>
                  </div>
                )}
                <DetailRow
                  label="Kind"
                  value={KIND_LABELS[transaction.kind ?? 'expense'] ?? (transaction.kind ?? '—')}
                  testId="detail-kind"
                />
                <DetailRow
                  label="Tax Code"
                  value={transaction.taxCode ? (TAX_CODE_LABELS[transaction.taxCode] ?? transaction.taxCode) : '—'}
                  testId="detail-tax-code"
                />
                {transaction.taxRate != null && (
                  <DetailRow
                    label="Tax Rate"
                    value={`${transaction.taxRate}%`}
                    testId="detail-tax-rate"
                  />
                )}
                <DetailRow
                  label="Tax Inclusive"
                  value={transaction.taxInclusive ? 'Yes' : 'No'}
                  testId="detail-tax-inclusive"
                />
                <DetailRow
                  label="Affects P&L"
                  value={transaction.affectsProfit ? 'Yes' : 'No — excluded from profit calculation'}
                  testId="detail-affects-pnl"
                />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DetailRow({
  label,
  value,
  testId,
  className,
}: {
  label: string;
  value: string | number;
  testId: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </dt>
      <dd className="text-sm font-medium" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
