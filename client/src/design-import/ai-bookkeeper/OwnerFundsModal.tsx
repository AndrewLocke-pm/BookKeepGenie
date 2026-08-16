import React, { useState, useMemo } from "react";
import Dashboard from "./Dashboard";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import "./_group.css";

export default function OwnerFundsModal() {
  const initialState = useMemo(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const state = params.get("state");
      if (state === "loan") return 2;
      if (state === "override" || state === "warning") return 3;
    }
    return 1;
  }, []);

  const initialWarning = useMemo(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("state") === "warning";
    }
    return false;
  }, []);

  const [selected, setSelected] = useState(initialState);
  const [showOverrideWarning, setShowOverrideWarning] = useState(initialWarning);

  const getConfirmLabel = () => {
    if (selected === 1) return "Confirm as Capital";
    if (selected === 2) return "Confirm as Owner Loan";
    return "Continue with Income Override";
  };

  const handleConfirm = () => {
    if (selected === 3 && !showOverrideWarning) {
      setShowOverrideWarning(true);
    } else {
      // Actually confirm and close modal
      console.log("Confirmed selection", selected);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[var(--page-bg)]">
      {/* Background (blurred Dashboard) */}
      <div className="absolute inset-0 filter blur-[2px] opacity-60 pointer-events-none hidden sm:block">
        <Dashboard />
      </div>
      <div className="absolute inset-0 bg-slate-900/40 z-40"></div>

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-[92vw] sm:w-full max-w-[560px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="p-4 sm:p-6 pb-4 flex gap-3 sm:gap-4 items-start border-b border-[var(--border)] bg-white">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--warning-subtle)] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--warning)]" />
            </div>
            <div>
              <h2 className="text-[16px] sm:text-[18px] font-bold text-[var(--text-primary)]">This looks like Owner Funds</h2>
              <p className="text-[13px] sm:text-[14px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                This R50,000.00 transaction from John Owner may be money you put into the business rather than normal business revenue.
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 bg-[var(--surface-subtle)] flex-1 overflow-y-auto max-h-[60vh] sm:max-h-[none]">
            {showOverrideWarning ? (
              <div className="bg-white border-2 border-[var(--danger)] rounded-xl p-4 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-3 mb-3 text-[var(--warning)] font-bold text-[15px] sm:text-[16px]">
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                  Are you sure this is business income?
                </div>
                <p className="text-[13px] sm:text-[14px] text-[var(--text-secondary)] leading-relaxed mb-6">
                  Classifying this as income means it will be included in revenue and profit, and may affect VAT. Capital and owner loans should not be classified as income.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <button 
                    onClick={() => setShowOverrideWarning(false)}
                    className="flex-1 py-2.5 rounded-md text-[14px] font-medium text-[var(--text-primary)] border border-[var(--border-strong)] hover:bg-[var(--surface-subtle)] transition-colors order-2 sm:order-1"
                  >
                    Go Back
                  </button>
                  <button 
                    onClick={() => console.log("Confirmed override")}
                    className="flex-1 py-2.5 rounded-md text-[14px] font-medium text-white bg-[var(--danger)] hover:bg-red-700 transition-colors shadow-sm order-1 sm:order-2"
                  >
                    Yes, Classify as Income
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-[13px] sm:text-[14px] font-semibold text-[var(--text-primary)] mb-4">How would you like to classify this?</h3>
                
                <div className="space-y-3">
                  
                  {/* Option 1 */}
                  <button 
                    onClick={() => setSelected(1)}
                    className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all flex items-start gap-3 sm:gap-4 ${
                      selected === 1 
                        ? "border-[var(--warning)] bg-[var(--warning-subtle)]/30" 
                        : "border-[var(--border)] bg-white hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                      selected === 1 ? "border-[var(--warning)]" : "border-[var(--border-strong)]"
                    }`}>
                      {selected === 1 && <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[var(--warning)]"></div>}
                    </div>
                    <div>
                      <div className="font-semibold text-[13px] sm:text-[14px] text-[var(--text-primary)]">Capital Contribution</div>
                      <div className="text-[12px] sm:text-[13px] text-[var(--text-secondary)] mt-0.5">Money invested in the business as owner equity.</div>
                      <div className="flex flex-wrap gap-2 mt-2 sm:mt-3">
                        <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200 uppercase tracking-wide">Does not affect profit</span>
                        <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200 uppercase tracking-wide">Out of scope for VAT</span>
                        <span className="hidden sm:inline bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200 uppercase tracking-wide">Appears in owner's equity</span>
                      </div>
                    </div>
                  </button>

                  {/* Option 2 */}
                  <button 
                    onClick={() => setSelected(2)}
                    className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all flex items-start gap-3 sm:gap-4 ${
                      selected === 2 
                        ? "border-[var(--warning)] bg-[var(--warning-subtle)]/30" 
                        : "border-[var(--border)] bg-white hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                      selected === 2 ? "border-[var(--warning)]" : "border-[var(--border-strong)]"
                    }`}>
                      {selected === 2 && <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[var(--warning)]"></div>}
                    </div>
                    <div>
                      <div className="font-semibold text-[13px] sm:text-[14px] text-[var(--text-primary)]">Owner / Director Loan</div>
                      <div className="text-[12px] sm:text-[13px] text-[var(--text-secondary)] mt-0.5">Money lent to the business that may be repayable to the owner.</div>
                      <div className="flex flex-wrap gap-2 mt-2 sm:mt-3">
                        <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200 uppercase tracking-wide">Does not affect profit</span>
                        <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200 uppercase tracking-wide">Out of scope for VAT</span>
                        <span className="hidden sm:inline bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200 uppercase tracking-wide">Appears as a liability</span>
                      </div>
                    </div>
                  </button>

                  {/* Option 3 */}
                  <button 
                    onClick={() => setSelected(3)}
                    className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all flex items-start gap-3 sm:gap-4 ${
                      selected === 3 
                        ? "border-[var(--danger)] bg-[var(--danger-subtle)]/10" 
                        : "border-[var(--border)] bg-white hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                      selected === 3 ? "border-[var(--danger)]" : "border-[var(--border-strong)]"
                    }`}>
                      {selected === 3 && <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[var(--danger)]"></div>}
                    </div>
                    <div>
                      <div className="font-semibold text-[13px] sm:text-[14px] text-[var(--danger)] flex items-center gap-1.5">
                        Override — Classify as Income
                      </div>
                      <div className="text-[12px] sm:text-[13px] text-[var(--text-secondary)] mt-1 flex items-start gap-1.5">
                        Select this only when the amount is genuinely earned from customers or normal business activity.
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2 sm:mt-3">
                        <span className="bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger)]/20 text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wide">Affects profit</span>
                        <span className="bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger)]/20 text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wide">VAT treatment depends on code</span>
                      </div>
                    </div>
                  </button>

                </div>

                {/* Explanation Box */}
                <div className="mt-4 sm:mt-6 bg-[var(--primary-subtle)] text-[var(--primary)] p-3 sm:p-4 rounded-lg text-[12px] sm:text-[13px] flex items-start gap-3">
                  <Info className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" />
                  <p>
                    Capital contributions and owner loans do not appear in revenue or expenses. They are shown correctly in the Balance Sheet and Cash Flow Statement.
                  </p>
                </div>
              </>
            )}

          </div>

          {/* Footer */}
          {!showOverrideWarning && (
            <div className="p-4 sm:px-6 bg-white border-t border-[var(--border)] flex flex-col sm:flex-row justify-end gap-3">
              <button className="w-full sm:w-auto px-4 py-2.5 rounded-md text-[14px] font-medium text-[var(--text-secondary)] border border-[var(--border-strong)] hover:bg-[var(--surface-subtle)] transition-colors order-2 sm:order-1">
                Cancel
              </button>
              <button 
                onClick={handleConfirm}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-md text-[14px] font-medium text-white shadow-sm transition-colors order-1 sm:order-2 ${
                  selected === 3 ? "bg-[var(--danger)] hover:bg-red-700" : "bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
                }`}
              >
                {getConfirmLabel()}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
