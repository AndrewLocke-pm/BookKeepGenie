import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { formatDateInput } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { type TransactionWithCategory, type Category } from "@shared/schema";

interface TransactionEditDialogProps {
  transaction: TransactionWithCategory;
  categories: Category[];
  open: boolean;
  onClose: () => void;
  focusCategory?: boolean;
}

export function TransactionEditDialog({
  transaction,
  categories,
  open,
  onClose,
  focusCategory = false,
}: TransactionEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // When opened via the low-confidence badge, auto-focus the category field
  useEffect(() => {
    if (open && focusCategory) {
      const timer = setTimeout(() => {
        document.getElementById("edit-category")?.focus();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [open, focusCategory]);

  const [formData, setFormData] = useState({
    vendor: transaction.vendor,
    amount: transaction.amount,
    date: formatDateInput(transaction.date),
    description: transaction.description || "",
    categoryId: transaction.categoryId?.toString() || "",
    type: transaction.type,
    // Derive direction from type if not present (for legacy transactions)
    direction: (transaction as any).direction || (transaction.type === 'income' ? 'inflow' : 'outflow'),
    kind: (transaction as any).kind || (transaction.type === 'income' ? 'income' : 'expense'),
    affectsProfit: (transaction as any).affectsProfit ?? true,
    taxCode: transaction.taxCode || "standard",
    taxRate: transaction.taxRate?.toString() || "1500",
    taxInclusive: transaction.taxInclusive ?? true,
    supplyType: transaction.supplyType || "goods",
  });

  useEffect(() => {
    setFormData({
      vendor: transaction.vendor,
      amount: transaction.amount,
      date: formatDateInput(transaction.date),
      description: transaction.description || "",
      categoryId: transaction.categoryId?.toString() || "",
      type: transaction.type,
      // Derive direction from type if not present (for legacy transactions)
      direction: (transaction as any).direction || (transaction.type === 'income' ? 'inflow' : 'outflow'),
      kind: (transaction as any).kind || (transaction.type === 'income' ? 'income' : 'expense'),
      affectsProfit: (transaction as any).affectsProfit ?? true,
      taxCode: transaction.taxCode || "standard",
      taxRate: transaction.taxRate?.toString() || "1500",
      taxInclusive: transaction.taxInclusive ?? true,
      supplyType: transaction.supplyType || "goods",
    });
  }, [transaction]);
  
  // Check if owner funds (capital/owner_loan/transfer) - these should have VAT fields disabled
  const isOwnerFunds = ['capital', 'owner_loan', 'transfer'].includes(formData.kind);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('PATCH', `/api/transactions/${transaction.id}`, {
        ...formData,
        categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
        taxRate: parseInt(formData.taxRate),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Transaction Updated",
        description: "Your changes have been saved",
      });
      onClose();
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
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor || !formData.amount || !formData.date) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent data-testid="dialog-edit-transaction">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>
            Make changes to your transaction details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-vendor">Vendor *</Label>
            <Input
              id="edit-vendor"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              data-testid="input-edit-vendor"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-amount">Amount *</Label>
            <Input
              id="edit-amount"
              type="text"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="font-mono"
              data-testid="input-edit-amount"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-date">Date *</Label>
            <Input
              id="edit-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              data-testid="input-edit-date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-category">Category</Label>
            <Select
              value={formData.categoryId}
              onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
            >
              <SelectTrigger id="edit-category" data-testid="select-edit-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-type">Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: "expense" | "income") =>
                setFormData({ ...formData, type: value })
              }
            >
              <SelectTrigger id="edit-type" data-testid="select-edit-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-kind">Transaction Kind</Label>
              <Select
                value={formData.kind}
                onValueChange={(value) => {
                  const newFormData = { ...formData, kind: value };
                  // Auto-set owner funds properties
                  if (['capital', 'owner_loan', 'transfer'].includes(value)) {
                    newFormData.affectsProfit = false;
                    newFormData.taxCode = 'out_of_scope';
                    newFormData.direction = 'inflow';
                  } else {
                    // Reset to normal transaction defaults when switching away from owner funds
                    newFormData.affectsProfit = true;
                    newFormData.taxCode = 'standard';
                    newFormData.direction = value === 'income' ? 'inflow' : 'outflow';
                  }
                  setFormData(newFormData);
                }}
              >
                <SelectTrigger id="edit-kind" data-testid="select-edit-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="capital">Capital Contribution</SelectItem>
                  <SelectItem value="owner_loan">Director's Loan</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="tax">Tax Payment</SelectItem>
                </SelectContent>
              </Select>
              {isOwnerFunds && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Owner funds are excluded from P&L and VAT calculations
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-direction">Direction</Label>
              <Select
                value={formData.direction}
                onValueChange={(value) => setFormData({ ...formData, direction: value })}
                disabled={isOwnerFunds}
              >
                <SelectTrigger 
                  id="edit-direction" 
                  data-testid="select-edit-direction"
                  className={isOwnerFunds ? "opacity-50 cursor-not-allowed" : ""}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inflow">Inflow (Money In)</SelectItem>
                  <SelectItem value="outflow">Outflow (Money Out)</SelectItem>
                </SelectContent>
              </Select>
              {isOwnerFunds && (
                <p className="text-xs text-muted-foreground">
                  Locked to inflow for owner funds
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              data-testid="input-edit-description"
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-3">Tax Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-tax-code">Tax Code</Label>
                <Select
                  value={formData.taxCode}
                  onValueChange={(value) => setFormData({ ...formData, taxCode: value })}
                  disabled={isOwnerFunds}
                >
                  <SelectTrigger 
                    id="edit-tax-code" 
                    data-testid="select-edit-tax-code"
                    className={isOwnerFunds ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (15% VAT)</SelectItem>
                    <SelectItem value="zero_rated">Zero-rated</SelectItem>
                    <SelectItem value="exempt">Exempt</SelectItem>
                    <SelectItem value="out_of_scope">Out of Scope</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-supply-type">Supply Type</Label>
                <Select
                  value={formData.supplyType}
                  onValueChange={(value) => setFormData({ ...formData, supplyType: value })}
                  disabled={isOwnerFunds}
                >
                  <SelectTrigger 
                    id="edit-supply-type" 
                    data-testid="select-edit-supply-type"
                    className={isOwnerFunds ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="goods">Goods</SelectItem>
                    <SelectItem value="services">Services</SelectItem>
                    <SelectItem value="import">Import</SelectItem>
                    <SelectItem value="export">Export</SelectItem>
                    <SelectItem value="capital">Capital Goods</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-tax-rate">Tax Rate (basis points)</Label>
                <Input
                  id="edit-tax-rate"
                  type="number"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                  className={`font-mono ${isOwnerFunds ? "opacity-50 cursor-not-allowed" : ""}`}
                  disabled={isOwnerFunds}
                  data-testid="input-edit-tax-rate"
                />
                <p className="text-xs text-muted-foreground">
                  1500 = 15%, 0 = 0%
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-tax-inclusive" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    id="edit-tax-inclusive"
                    checked={formData.taxInclusive}
                    onChange={(e) => setFormData({ ...formData, taxInclusive: e.target.checked })}
                    disabled={isOwnerFunds}
                    data-testid="input-edit-tax-inclusive"
                    className={isOwnerFunds ? "cursor-not-allowed" : ""}
                  />
                  <span className={isOwnerFunds ? "opacity-50" : ""}>Tax Inclusive</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Check if amount includes VAT
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1"
              data-testid="button-save-edit"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
