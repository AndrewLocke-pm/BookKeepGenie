import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileImage, ExternalLink, Search } from 'lucide-react';
import { Link } from 'wouter';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useOrgFetch } from '@/context/organisation-context';
import type { TransactionWithCategory } from '@shared/schema';

export default function Receipts() {
  const { orgFetch, selectedOrgId } = useOrgFetch();
  const [search, setSearch] = useState('');

  const { data: transactions = [], isLoading } = useQuery<TransactionWithCategory[]>({
    queryKey: ['/api/transactions', selectedOrgId],
    queryFn: orgFetch('/api/transactions'),
  });

  const receipts = useMemo(() => {
    const withReceipts = transactions.filter(t => t.receiptUrl);
    if (!search.trim()) return withReceipts;
    const q = search.toLowerCase();
    return withReceipts.filter(
      t =>
        t.vendor.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q),
    );
  }, [transactions, search]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Receipt Documents</h1>
          <p className="text-muted-foreground mt-1">
            Transactions with attached receipt files ({receipts.length} of {transactions.length}).
          </p>
        </div>
      </div>

      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search receipts…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-receipts"
        />
      </div>

      {receipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <FileImage className="w-12 h-12 text-muted-foreground" />
          <div>
            <p className="font-medium">No receipts found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search
                ? 'No receipts match your search.'
                : 'Upload a transaction with a receipt to see it here.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {receipts.map(txn => {
            const amount = parseFloat(String(txn.amount ?? 0));
            const isInflow = txn.direction === 'inflow';
            const isImage = txn.receiptUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

            return (
              <Card key={txn.id} className="overflow-hidden" data-testid={`receipt-card-${txn.id}`}>
                {/* Thumbnail */}
                <div className="h-36 bg-muted/40 flex items-center justify-center overflow-hidden">
                  {isImage ? (
                    <img
                      src={txn.receiptUrl!}
                      alt="Receipt thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileImage className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>

                <CardContent className="pt-3 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{txn.vendor}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(txn.date)}</p>
                    </div>
                    <p
                      className={`text-sm font-semibold shrink-0 ${isInflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
                    >
                      {isInflow ? '+' : '-'}{formatCurrency(Math.abs(amount))}
                    </p>
                  </div>

                  {txn.category && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      {txn.category.name}
                    </Badge>
                  )}

                  {txn.aiProcessed === 1 && txn.aiConfidence != null && (
                    <p className="text-xs text-muted-foreground mt-2">
                      AI confidence:{' '}
                      {Math.round(parseFloat(String(txn.aiConfidence)) * 100)}%
                    </p>
                  )}

                  <div className="flex gap-2 mt-3">
                    <Link href={`/transactions/${txn.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-txn-${txn.id}`}>
                        View Transaction
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" asChild>
                      <a
                        href={txn.receiptUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open receipt"
                        data-testid={`button-open-receipt-${txn.id}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
