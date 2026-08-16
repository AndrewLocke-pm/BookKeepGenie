import { useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

type Decision = 'capital' | 'owner_loan' | 'expense';

interface BkOwnerFundsModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (decision: Decision) => void;
  transactionDetails?: {
    vendor?: string;
    description?: string;
    amount?: string;
  };
  initialSelected?: Decision;
  initialOverrideWarning?: boolean;
}

export function BkOwnerFundsModal({
  open,
  onClose,
  onConfirm,
  transactionDetails,
  initialSelected = 'capital',
  initialOverrideWarning = false,
}: BkOwnerFundsModalProps) {
  const [selected, setSelected] = useState<Decision>(initialSelected);
  const [showOverrideWarning, setShowOverrideWarning] = useState(initialOverrideWarning);

  const reset = () => {
    setSelected('capital');
    setShowOverrideWarning(false);
  };

  const handleCancel = () => {
    onClose();
    reset();
  };

  const handleConfirm = () => {
    if (selected === 'expense' && !showOverrideWarning) {
      setShowOverrideWarning(true);
      return;
    }
    onConfirm(selected);
    onClose();
    reset();
  };

  const confirmLabel =
    selected === 'capital' ? 'Confirm as Capital'
    : selected === 'owner_loan' ? 'Confirm as Owner Loan'
    : 'Continue with Override';

  const amountLabel = transactionDetails?.amount ? `R${transactionDetails.amount}` : 'This';
  const vendorLabel = transactionDetails?.vendor ? ` from ${transactionDetails.vendor}` : '';

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleCancel(); }}>
      <DialogContent
        className="p-0 gap-0 max-w-[560px] w-[92vw] sm:w-full overflow-hidden rounded-xl border-0"
        data-testid="dialog-owner-funds-decision"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 pb-4 flex gap-3 sm:gap-4 items-start border-b border-[var(--bk-border)] bg-white">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--bk-warning-subtle)] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--bk-warning)]" />
          </div>
          <div>
            <DialogTitle className="text-[16px] sm:text-[18px] font-bold text-[var(--bk-text-primary)]">
              This looks like Owner Funds
            </DialogTitle>
            <DialogDescription className="text-[13px] sm:text-[14px] text-[var(--bk-text-secondary)] mt-1.5 leading-relaxed">
              {amountLabel} transaction{vendorLabel} may be money you put into the business rather
              than a normal business expense. It shouldn't affect profit and has no VAT.
            </DialogDescription>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 bg-[var(--bk-surface-subtle)] flex-1 overflow-y-auto max-h-[60vh]">
          {showOverrideWarning ? (
            <div className="bg-white border-2 border-[var(--bk-danger)] rounded-xl p-4 sm:p-6" data-testid="panel-override-warning">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 text-[var(--bk-warning)] font-bold text-[15px] sm:text-[16px]">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                Are you sure this is a business expense?
              </div>
              <p className="text-[13px] sm:text-[14px] text-[var(--bk-text-secondary)] leading-relaxed mb-6">
                This transaction will be included in revenue and profit. Its VAT treatment depends
                on the selected tax code. Capital contributions and owner loans should not be
                classified this way.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button
                  onClick={() => setShowOverrideWarning(false)}
                  className="flex-1 py-2.5 rounded-md text-[14px] font-medium text-[var(--bk-text-primary)] border border-[var(--bk-border-strong)] hover:bg-[var(--bk-surface-subtle)] transition-colors order-2 sm:order-1"
                  data-testid="button-back-classification"
                >
                  Go Back
                </button>
                <button
                  onClick={() => { onConfirm('expense'); onClose(); reset(); }}
                  className="flex-1 py-2.5 rounded-md text-[14px] font-medium text-white bg-[var(--bk-danger)] hover:bg-red-700 transition-colors shadow-sm order-1 sm:order-2"
                  data-testid="button-confirm-expense-override"
                >
                  Yes, Classify as Expense
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-[13px] sm:text-[14px] font-semibold text-[var(--bk-text-primary)] mb-4">
                How would you like to classify this?
              </h3>

              <div className="space-y-3">
                {/* Capital */}
                <button
                  onClick={() => setSelected('capital')}
                  data-testid="radio-capital"
                  className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all flex items-start gap-3 sm:gap-4 ${
                    selected === 'capital'
                      ? 'border-[var(--bk-warning)] bg-[var(--bk-warning-subtle)]/30'
                      : 'border-[var(--bk-border)] bg-white hover:border-[var(--bk-border-strong)]'
                  }`}
                >
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                    selected === 'capital' ? 'border-[var(--bk-warning)]' : 'border-[var(--bk-border-strong)]'
                  }`}>
                    {selected === 'capital' && <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[var(--bk-warning)]"></div>}
                  </div>
                  <div>
                    <div className="font-semibold text-[13px] sm:text-[14px] text-[var(--bk-text-primary)]">Capital Contribution</div>
                    <div className="text-[12px] sm:text-[13px] text-[var(--bk-text-secondary)] mt-0.5">Money invested in the business as owner equity, not expected back.</div>
                    <div className="flex flex-wrap gap-2 mt-2 sm:mt-3">
                      <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200 uppercase tracking-wide">Does not affect profit</span>
                      <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200 uppercase tracking-wide">Out of scope for VAT</span>
                      <span className="hidden sm:inline bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200 uppercase tracking-wide">Appears in owner's equity</span>
                    </div>
                  </div>
                </button>

                {/* Owner loan */}
                <button
                  onClick={() => setSelected('owner_loan')}
                  data-testid="radio-owner-loan"
                  className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all flex items-start gap-3 sm:gap-4 ${
                    selected === 'owner_loan'
                      ? 'border-[var(--bk-warning)] bg-[var(--bk-warning-subtle)]/30'
                      : 'border-[var(--bk-border)] bg-white hover:border-[var(--bk-border-strong)]'
                  }`}
                >
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                    selected === 'owner_loan' ? 'border-[var(--bk-warning)]' : 'border-[var(--bk-border-strong)]'
                  }`}>
                    {selected === 'owner_loan' && <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[var(--bk-warning)]"></div>}
                  </div>
                  <div>
                    <div className="font-semibold text-[13px] sm:text-[14px] text-[var(--bk-text-primary)]">Owner / Director Loan</div>
                    <div className="text-[12px] sm:text-[13px] text-[var(--bk-text-secondary)] mt-0.5">Money lent to the business that may be repayable to the owner.</div>
                    <div className="flex flex-wrap gap-2 mt-2 sm:mt-3">
                      <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200 uppercase tracking-wide">Does not affect profit</span>
                      <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200 uppercase tracking-wide">Out of scope for VAT</span>
                      <span className="hidden sm:inline bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200 uppercase tracking-wide">Appears as a liability</span>
                    </div>
                  </div>
                </button>

                {/* Override */}
                <button
                  onClick={() => setSelected('expense')}
                  data-testid="radio-expense-override"
                  className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all flex items-start gap-3 sm:gap-4 ${
                    selected === 'expense'
                      ? 'border-[var(--bk-danger)] bg-[var(--bk-danger-subtle)]/10'
                      : 'border-[var(--bk-border)] bg-white hover:border-[var(--bk-border-strong)]'
                  }`}
                >
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                    selected === 'expense' ? 'border-[var(--bk-danger)]' : 'border-[var(--bk-border-strong)]'
                  }`}>
                    {selected === 'expense' && <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[var(--bk-danger)]"></div>}
                  </div>
                  <div>
                    <div className="font-semibold text-[13px] sm:text-[14px] text-[var(--bk-danger)] flex items-center gap-1.5">
                      Override — This is a Business Expense
                    </div>
                    <div className="text-[12px] sm:text-[13px] text-[var(--bk-text-secondary)] mt-1">
                      Select this only when the amount was genuinely spent on normal business activity.
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2 sm:mt-3">
                      <span className="bg-[var(--bk-danger-subtle)] text-[var(--bk-danger)] border border-[var(--bk-danger)]/20 text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wide">Affects profit</span>
                      <span className="bg-[var(--bk-danger-subtle)] text-[var(--bk-danger)] border border-[var(--bk-danger)]/20 text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wide">VAT treatment depends on code</span>
                    </div>
                  </div>
                </button>
              </div>

              {/* Explanation box */}
              <div className="mt-4 sm:mt-6 bg-[var(--bk-primary-subtle)] text-[var(--bk-primary)] p-3 sm:p-4 rounded-lg text-[12px] sm:text-[13px] flex items-start gap-3">
                <Info className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" />
                <p>
                  Capital contributions and owner loans do not appear in revenue or expenses. They
                  are shown correctly in the Balance Sheet and Cash Flow Statement.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!showOverrideWarning && (
          <div className="p-4 sm:px-6 bg-white border-t border-[var(--bk-border)] flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={handleCancel}
              className="w-full sm:w-auto px-4 py-2.5 rounded-md text-[14px] font-medium text-[var(--bk-text-secondary)] border border-[var(--bk-border-strong)] hover:bg-[var(--bk-surface-subtle)] transition-colors order-2 sm:order-1"
              data-testid="button-cancel-owner-funds"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-md text-[14px] font-medium text-white shadow-sm transition-colors order-1 sm:order-2 ${
                selected === 'expense'
                  ? 'bg-[var(--bk-danger)] hover:bg-red-700'
                  : 'bg-[var(--bk-primary)] hover:bg-[var(--bk-primary-hover)]'
              }`}
              data-testid="button-confirm-owner-funds"
            >
              {confirmLabel}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
