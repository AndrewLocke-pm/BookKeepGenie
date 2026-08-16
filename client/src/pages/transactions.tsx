import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { formatCurrency, formatDate, getCategoryColor } from "@/lib/utils";
import { useOrgFetch } from "@/context/organisation-context";
import { Search, Sparkles, Pencil, Trash2, Receipt, Filter, Download, AlertTriangle } from "lucide-react";
import { type TransactionWithCategory, type Category } from "@shared/schema";
import { TransactionEditDialog } from "@/components/transaction-edit-dialog";

export default function Transactions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedOrgId, orgUrl } = useOrgFetch();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithCategory | null>(null);
  const [focusCategoryOnEdit, setFocusCategoryOnEdit] = useState(false);

  const isLowConfidence = (t: TransactionWithCategory) =>
    t.aiConfidence !== null && t.aiConfidence !== undefined &&
    parseFloat(String(t.aiConfidence)) < 0.6;

  const { data: transactions, isLoading } = useQuery<TransactionWithCategory[]>({
    queryKey: ["/api/transactions", selectedOrgId],
    queryFn: orgUrl ? () => fetch(orgUrl('/api/transactions'), { credentials: 'include' }).then(r => r.json()) : undefined,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/transactions/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions", selectedOrgId] });
      toast({
        title: "Transaction Deleted",
        description: "The transaction has been removed",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredTransactions = transactions?.filter(t => {
    const matchesSearch = 
      t.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    const matchesCategory = categoryFilter === "all" || t.categoryId?.toString() === categoryFilter;
    const matchesType = typeFilter === "all" || t.type === typeFilter;
    return matchesSearch && matchesCategory && matchesType;
  }) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">All your financial records</p>
        </div>
        <Card>
          <CardContent className="p-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-4 border-b last:border-0">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleExportCSV = () => {
    window.location.href = '/api/transactions/export/csv';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-transactions-title">Transactions</h1>
          <p className="text-muted-foreground">All your financial records</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" data-testid="button-export-csv">
          <Download className="w-4 h-4 mr-2" />
          Export to CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter your transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search vendor or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger data-testid="select-category-filter">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger data-testid="select-type-filter">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {filteredTransactions.length} Transaction{filteredTransactions.length !== 1 ? 's' : ''}
          </CardTitle>
          <CardDescription>
            {categoryFilter !== "all" && `Filtered by category`}
            {typeFilter !== "all" && ` • Showing ${typeFilter} only`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="py-16 text-center">
              <Receipt className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
              <p className="text-muted-foreground">
                {searchTerm || categoryFilter !== "all" || typeFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Upload your first receipt to get started"}
              </p>
            </div>
          ) : (
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id} data-testid={`row-transaction-${transaction.id}`}>
                      <TableCell className="font-medium">
                        {formatDate(transaction.date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          {transaction.vendor}
                          {transaction.aiProcessed === 1 && (
                            <Badge variant="secondary" className="text-xs">
                              <Sparkles className="w-3 h-3 mr-1" />
                              AI
                            </Badge>
                          )}
                          {isLowConfidence(transaction) && (
                            <button
                              onClick={() => {
                                setEditingTransaction(transaction);
                                setFocusCategoryOnEdit(true);
                              }}
                              className="inline-flex"
                              data-testid={`badge-low-confidence-${transaction.id}`}
                            >
                              <Badge className="text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-400 dark:border-yellow-800/50 cursor-pointer">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Low confidence — please review
                              </Badge>
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {transaction.description || '-'}
                      </TableCell>
                      <TableCell>
                        {transaction.category ? (
                          <Badge
                            variant="secondary"
                            style={{
                              backgroundColor: `${getCategoryColor(transaction.category.name)}15`,
                              color: getCategoryColor(transaction.category.name),
                              borderColor: `${getCategoryColor(transaction.category.name)}30`,
                            }}
                          >
                            {transaction.category.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Uncategorized</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${
                        transaction.type === 'income' ? 'text-chart-2' : ''
                      }`}>
                        {transaction.type === 'income' ? '+' : ''}
                        {formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setFocusCategoryOnEdit(false);
                              setEditingTransaction(transaction);
                            }}
                            data-testid={`button-edit-${transaction.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this transaction?')) {
                                deleteMutation.mutate(transaction.id);
                              }
                            }}
                            data-testid={`button-delete-${transaction.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="md:hidden space-y-4">
            {filteredTransactions.map((transaction) => (
              <Card key={transaction.id} data-testid={`card-transaction-${transaction.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold flex flex-wrap items-center gap-2">
                        {transaction.vendor}
                        {transaction.aiProcessed === 1 && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="w-3 h-3 mr-1" />
                            AI
                          </Badge>
                        )}
                        {isLowConfidence(transaction) && (
                          <button
                            onClick={() => {
                              setEditingTransaction(transaction);
                              setFocusCategoryOnEdit(true);
                            }}
                            className="inline-flex"
                            data-testid={`badge-low-confidence-mobile-${transaction.id}`}
                          >
                            <Badge className="text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-400 dark:border-yellow-800/50 cursor-pointer">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Low confidence — please review
                            </Badge>
                          </button>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(transaction.date)}
                      </div>
                    </div>
                    <div className={`text-lg font-mono font-semibold ${
                      transaction.type === 'income' ? 'text-chart-2' : ''
                    }`}>
                      {transaction.type === 'income' ? '+' : ''}
                      {formatCurrency(transaction.amount)}
                    </div>
                  </div>

                  {transaction.category && (
                    <Badge
                      variant="secondary"
                      className="mb-3"
                      style={{
                        backgroundColor: `${getCategoryColor(transaction.category.name)}15`,
                        color: getCategoryColor(transaction.category.name),
                        borderColor: `${getCategoryColor(transaction.category.name)}30`,
                      }}
                    >
                      {transaction.category.name}
                    </Badge>
                  )}

                  {transaction.description && (
                    <p className="text-sm text-muted-foreground mb-3">{transaction.description}</p>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFocusCategoryOnEdit(false);
                        setEditingTransaction(transaction);
                      }}
                      className="flex-1"
                      data-testid={`button-edit-mobile-${transaction.id}`}
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this transaction?')) {
                          deleteMutation.mutate(transaction.id);
                        }
                      }}
                      data-testid={`button-delete-mobile-${transaction.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {editingTransaction && (
        <TransactionEditDialog
          transaction={editingTransaction}
          categories={categories || []}
          open={!!editingTransaction}
          onClose={() => { setEditingTransaction(null); setFocusCategoryOnEdit(false); }}
          focusCategory={focusCategoryOnEdit}
        />
      )}
    </div>
  );
}
