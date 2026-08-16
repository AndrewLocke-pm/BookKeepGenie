import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tag, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { useOrgFetch } from '@/context/organisation-context';
import type { Category, TransactionWithCategory } from '@shared/schema';

const SYSTEM_CATEGORY_NAMES = new Set([
  'Owner Funds In',
  "Director's Loan In",
  'Owner Funds Out',
  "Director's Loan Out",
  'Capital',
  'Owner Loan',
  'Transfer',
]);

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full shrink-0 border border-black/10"
      style={{ backgroundColor: color }}
    />
  );
}

export default function Categories() {
  const { orgFetch, selectedOrgId } = useOrgFetch();

  const { data: categories = [], isLoading: catsLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const { data: transactions = [], isLoading: txnLoading } = useQuery<TransactionWithCategory[]>({
    queryKey: ['/api/transactions', selectedOrgId],
    queryFn: orgFetch('/api/transactions'),
  });

  const isLoading = catsLoading || txnLoading;

  const categoryStats = useMemo(() => {
    const map = new Map<number, { count: number; total: number }>();
    for (const txn of transactions) {
      if (txn.categoryId == null) continue;
      const prev = map.get(txn.categoryId) ?? { count: 0, total: 0 };
      const amt = Math.abs(parseFloat(String(txn.amount ?? 0)));
      map.set(txn.categoryId, { count: prev.count + 1, total: prev.total + amt });
    }
    return map;
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }

  const systemCats = categories.filter(c => SYSTEM_CATEGORY_NAMES.has(c.name));
  const regularCats = categories.filter(c => !SYSTEM_CATEGORY_NAMES.has(c.name));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="text-muted-foreground mt-1">
          Transaction categories used to classify your bookkeeping entries.
        </p>
      </div>

      {/* Regular categories */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Categories
          </CardTitle>
          <CardDescription>{regularCats.length} categories</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {regularCats.length === 0 ? (
              <p className="text-sm text-muted-foreground px-6 py-8 text-center">
                No categories found.
              </p>
            ) : (
              regularCats.map(cat => {
                const stats = categoryStats.get(cat.id) ?? { count: 0, total: 0 };
                return (
                  <div
                    key={cat.id}
                    className="flex items-center gap-4 px-6 py-4"
                    data-testid={`category-row-${cat.id}`}
                  >
                    <ColorDot color={cat.color} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{cat.name}</p>
                      {cat.icon && (
                        <p className="text-xs text-muted-foreground capitalize">{cat.icon}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">{formatCurrency(stats.total)}</p>
                      <p className="text-xs text-muted-foreground">
                        {stats.count} {stats.count === 1 ? 'transaction' : 'transactions'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* System / protected categories */}
      {systemCats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" />
              System Categories
            </CardTitle>
            <CardDescription>
              Protected categories used to classify owner funds and transfers. These cannot be
              edited or deleted.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {systemCats.map(cat => {
                const stats = categoryStats.get(cat.id) ?? { count: 0, total: 0 };
                return (
                  <div
                    key={cat.id}
                    className="flex items-center gap-4 px-6 py-4"
                    data-testid={`category-row-system-${cat.id}`}
                  >
                    <ColorDot color={cat.color} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{cat.name}</p>
                      <Badge variant="secondary" className="mt-1 text-xs">Protected</Badge>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">{formatCurrency(stats.total)}</p>
                      <p className="text-xs text-muted-foreground">
                        {stats.count} {stats.count === 1 ? 'transaction' : 'transactions'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
