import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

interface OwnerFundsDecisionModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (decision: 'capital' | 'owner_loan' | 'expense') => void;
  transactionDetails?: {
    vendor?: string;
    description?: string;
    amount?: string;
  };
}

export function OwnerFundsDecisionModal({
  open,
  onClose,
  onConfirm,
  transactionDetails
}: OwnerFundsDecisionModalProps) {
  const [selectedType, setSelectedType] = useState<'capital' | 'owner_loan' | 'expense'>('capital');
  const [confirmationStep, setConfirmationStep] = useState<'select' | 'confirm-override'>('select');

  const handleConfirm = () => {
    // If user selected "expense", show confirmation step
    if (selectedType === 'expense' && confirmationStep === 'select') {
      setConfirmationStep('confirm-override');
      return;
    }
    
    onConfirm(selectedType);
    onClose();
    setConfirmationStep('select');
  };

  const handleBack = () => {
    setConfirmationStep('select');
  };

  const handleCancel = () => {
    onClose();
    setConfirmationStep('select');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-owner-funds-decision">
        {confirmationStep === 'select' ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                <DialogTitle>This Looks Like Owner Funds (Not an Expense)</DialogTitle>
              </div>
              <DialogDescription>
                Money put in by you or your director is a balance-sheet transaction, not an expense or income.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                It shouldn't affect profit and has no VAT.
              </p>
              {transactionDetails && (
                <div className="bg-muted p-3 rounded-md text-sm">
                  <p className="font-medium">Transaction Details:</p>
                  {transactionDetails.vendor && <p>Vendor: {transactionDetails.vendor}</p>}
                  {transactionDetails.description && <p>Description: {transactionDetails.description}</p>}
                  {transactionDetails.amount && <p>Amount: R{transactionDetails.amount}</p>}
                </div>
              )}
            </div>

            <div className="py-4">
              <RadioGroup value={selectedType} onValueChange={(value) => setSelectedType(value as 'capital' | 'owner_loan' | 'expense')}>
                <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover-elevate">
                  <RadioGroupItem value="capital" id="capital" data-testid="radio-capital" />
                  <div className="flex-1">
                    <Label htmlFor="capital" className="font-medium cursor-pointer">
                      Capital Contribution (Equity)
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Money put in, not expected back. Increases owner's equity in the business.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 mt-3 hover-elevate">
                  <RadioGroupItem value="owner_loan" id="owner_loan" data-testid="radio-owner-loan" />
                  <div className="flex-1">
                    <Label htmlFor="owner_loan" className="font-medium cursor-pointer">
                      Director's Loan
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Money in, to be repaid later. Creates a liability that the business owes back.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 mt-3 hover-elevate">
                  <RadioGroupItem value="expense" id="expense" data-testid="radio-expense-override" />
                  <div className="flex-1">
                    <Label htmlFor="expense" className="font-medium cursor-pointer">
                      This is Actually a Business Expense
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      The AI got it wrong—this is a normal expense that affects profit and VAT.
                    </p>
                  </div>
                </div>
              </RadioGroup>

              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Note:</strong> Capital and Director's Loan will be excluded from your Income Statement and VAT201 calculations.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCancel}
                data-testid="button-cancel-owner-funds"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                data-testid="button-confirm-owner-funds"
              >
                {selectedType === 'expense' ? 'Override Classification' : 'Confirm Classification'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Override</DialogTitle>
              <DialogDescription>
                You're about to classify this as a regular business expense.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-4">
                <p className="text-sm text-amber-900 dark:text-amber-100 font-medium mb-2">
                  ⚠️ Warning: This Transaction Will Affect Profit & VAT
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  If you classify this as an expense, it will:
                </p>
                <ul className="list-disc list-inside text-sm text-amber-800 dark:text-amber-200 mt-2 space-y-1">
                  <li>Reduce your profit on the Income Statement</li>
                  <li>Be included in VAT201 calculations</li>
                  <li>Affect your tax returns and compliance reports</li>
                </ul>
              </div>

              {transactionDetails && (
                <div className="bg-muted p-3 rounded-md text-sm">
                  <p className="font-medium mb-2">Transaction being classified:</p>
                  {transactionDetails.vendor && <p>Vendor: {transactionDetails.vendor}</p>}
                  {transactionDetails.description && <p>Description: {transactionDetails.description}</p>}
                  {transactionDetails.amount && <p>Amount: R{transactionDetails.amount}</p>}
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Are you sure this is a business expense and not owner funds?
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleBack}
                data-testid="button-back-classification"
              >
                Go Back
              </Button>
              <Button
                onClick={handleConfirm}
                variant="default"
                data-testid="button-confirm-expense-override"
              >
                Yes, Classify as Expense
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
