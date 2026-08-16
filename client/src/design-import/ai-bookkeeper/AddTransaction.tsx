import React, { useState } from "react";
import { AppShell } from "./_shared/AppShell";
import { 
  CheckCircle2, 
  FileText, 
  ChevronDown,
  Calendar,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  ExternalLink
} from "lucide-react";
import "./_group.css";

export default function AddTransaction() {
  const [activeTab, setActiveTab] = useState("Upload Receipt");
  const [receiptExpanded, setReceiptExpanded] = useState(false);

  return (
    <AppShell activePage="Add Transaction">
      <div className="flex flex-col sm:flex-row h-auto sm:h-[calc(100vh-64px)] sm:overflow-hidden relative">
        
        {/* Left Side: Upload & AI Extraction Area */}
        <div className="w-full sm:w-[40%] border-b sm:border-b-0 sm:border-r border-[var(--border)] bg-[var(--surface-subtle)] flex flex-col h-auto sm:h-full sm:overflow-y-auto">
          <div className="p-4 sm:p-8">
            <h1 className="text-[24px] font-bold text-[var(--text-primary)] mb-6 hidden sm:block">Add Transaction</h1>
            
            {/* Tabs */}
            <div className="flex p-1 bg-[var(--border)] rounded-lg mb-4 sm:mb-8 inline-flex overflow-x-auto w-full sm:w-auto scrollbar-hide">
              {["Upload Receipt", "Natural Language", "Manual Entry"].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap px-4 py-1.5 text-[13px] font-medium rounded-md transition-all flex-1 sm:flex-none ${
                    activeTab === tab 
                      ? "bg-white text-[var(--text-primary)] shadow-sm" 
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Placeholder for Natural Language when selected */}
            {activeTab === "Natural Language" && (
              <div className="mb-6">
                <textarea 
                  placeholder="e.g. Paid R1,500 to the plumber on 3 April"
                  className="w-full bg-white border border-[var(--border)] rounded-xl p-4 text-[14px] min-h-[120px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-sm resize-none"
                />
              </div>
            )}

            {/* Mobile Toggle */}
            {activeTab === "Upload Receipt" && (
              <div className="sm:hidden mb-4">
                <button 
                  onClick={() => setReceiptExpanded(!receiptExpanded)}
                  className="w-full py-2 bg-white border border-[var(--border)] rounded-md text-[13px] font-medium text-[var(--text-primary)] shadow-sm flex items-center justify-center gap-2"
                >
                  {receiptExpanded ? "Hide Receipt ▲" : "Show Receipt ▼"}
                </button>
              </div>
            )}

            {/* Receipt Preview */}
            {activeTab === "Upload Receipt" && (
              <div className={`bg-white border border-[var(--border)] rounded-xl shadow-sm overflow-hidden mb-6 sm:block ${receiptExpanded ? "block" : "hidden"}`}>
                <div className="bg-slate-800 p-4 flex justify-between items-center text-white text-[12px]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    receipt_builders.pdf
                  </div>
                  <div className="text-slate-400">1.2 MB</div>
                </div>
                
                {/* Controls Bar */}
                <div className="bg-slate-700 px-3 py-1.5 flex items-center justify-end gap-2 border-b border-slate-600 overflow-x-auto scrollbar-hide">
                  <button className="whitespace-nowrap flex items-center gap-1.5 text-slate-300 hover:text-white px-2 py-1 rounded text-[11px] transition-colors">
                    <ZoomIn className="w-3.5 h-3.5" /> Zoom In
                  </button>
                  <button className="whitespace-nowrap flex items-center gap-1.5 text-slate-300 hover:text-white px-2 py-1 rounded text-[11px] transition-colors">
                    <ZoomOut className="w-3.5 h-3.5" /> Zoom Out
                  </button>
                  <div className="w-px h-3 bg-slate-600 mx-1"></div>
                  <button className="whitespace-nowrap flex items-center gap-1.5 text-slate-300 hover:text-white px-2 py-1 rounded text-[11px] transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> Full Receipt
                  </button>
                </div>
                
                {/* Fake Receipt Visual */}
                <div className="p-8 bg-[#fdfdfc] font-mono text-[12px] text-slate-800 min-h-[300px] flex flex-col items-center border-b border-[var(--border)]">
                  <div className="text-center font-bold text-[16px] mb-2 uppercase tracking-widest">BUILDERS WAREHOUSE</div>
                  <div className="text-center text-[10px] text-slate-500 mb-6">
                    Tax Invoice: INV-99834<br/>
                    VAT Reg: 4930293846<br/>
                    29 Apr 2024 14:32
                  </div>
                  
                  <div className="w-full max-w-[240px] space-y-2 mb-6 border-y border-dashed border-slate-300 py-4">
                    <div className="flex justify-between">
                      <span>CEMENT 50KG x10</span>
                      <span>1,200.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PVC PIPES 50MM x20</span>
                      <span>1,856.78</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DELIVERY FEE</span>
                      <span>400.00</span>
                    </div>
                  </div>
                  
                  <div className="w-full max-w-[240px]">
                    <div className="flex justify-between font-bold text-[14px]">
                      <span>TOTAL</span>
                      <span>R3,456.78</span>
                    </div>
                    <div className="flex justify-between text-[10px] mt-1 text-slate-500">
                      <span>VAT Included @ 15%</span>
                      <span>R450.88</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Extraction Banner */}
            <div className="bg-[var(--success-subtle)] border border-[var(--success)]/20 rounded-xl p-4 flex items-start gap-3 mb-6">
              <CheckCircle2 className="w-5 h-5 text-[var(--success)] shrink-0 mt-0.5" />
              <div>
                <h3 className="text-[14px] font-bold text-[var(--success)]">AI Extraction Complete</h3>
                <p className="text-[13px] text-[var(--success)]/80 mt-0.5">Review the extracted fields below and confirm them on the right.</p>
              </div>
            </div>

            {/* Confidence Indicators */}
            <div className={`space-y-4 mb-8 sm:block ${receiptExpanded ? "block" : "hidden"}`}>
              <ConfidenceItem label="Vendor" value="Builders Warehouse" level="high" />
              <ConfidenceItem label="Date" value="29 Apr 2024" level="high" />
              <ConfidenceItem label="Amount" value="R3,456.78" level="high" />
              <ConfidenceItem label="Description" value="Building materials" level="medium" />
              <ConfidenceItem label="Category" value="Plumbing Supplies" level="medium" isSuggested />
            </div>

          </div>
        </div>

        {/* Right Side: Review Form */}
        <div className="w-full sm:w-[60%] bg-white h-auto sm:h-full sm:overflow-y-auto pb-[88px] sm:pb-0">
          <div className="max-w-2xl mx-auto p-6 sm:p-12 sm:pb-24">
            <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-2">Review & Confirm</h2>
            <p className="text-[14px] text-[var(--text-secondary)] mb-8">
              The AI extracted the following — please review and confirm before saving.
            </p>

            <form className="space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-[var(--text-primary)]">Vendor</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      defaultValue="Builders Warehouse" 
                      className="w-full bg-white border border-[var(--success)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--success)] pr-8 shadow-sm"
                    />
                    <CheckCircle2 className="absolute right-2.5 top-2.5 w-4 h-4 text-[var(--success)]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-[var(--text-primary)]">Date</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      defaultValue="29 Apr 2024" 
                      className="w-full bg-white border border-[var(--success)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--success)] pl-9 pr-8 shadow-sm"
                    />
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-secondary)]" />
                    <CheckCircle2 className="absolute right-2.5 top-2.5 w-4 h-4 text-[var(--success)]" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[var(--text-primary)]">Amount</label>
                <div className="relative">
                  <input 
                    type="text" 
                    defaultValue="3456.78" 
                    className="w-full bg-white border border-[var(--success)] rounded-md px-3 py-2 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--success)] pl-8 pr-8 shadow-sm tabular-nums"
                  />
                  <span className="absolute left-3 top-2.5 text-[14px] text-[var(--text-secondary)]">R</span>
                  <CheckCircle2 className="absolute right-2.5 top-2.5 w-4 h-4 text-[var(--success)]" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-[var(--text-primary)] flex justify-between">
                  Description
                  <span className="text-[11px] text-[var(--warning)] font-normal flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Needs review
                  </span>
                </label>
                <input 
                  type="text" 
                  defaultValue="Building materials" 
                  className="w-full bg-white border border-[var(--warning)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--warning)] shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-[var(--text-primary)]">Category</label>
                  <div className="relative">
                    <select className="w-full bg-white border border-[var(--border)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-sm appearance-none cursor-pointer">
                      <option>Plumbing Supplies</option>
                      <option>Fuel</option>
                      <option>Maintenance</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-[var(--text-secondary)] pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-[var(--text-primary)]">Transaction Type</label>
                  <div className="relative">
                    <select className="w-full bg-white border border-[var(--border)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-sm appearance-none cursor-pointer">
                      <option>Expense</option>
                      <option>Income</option>
                      <option>Equity</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-[var(--text-secondary)] pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-[var(--text-primary)]">Tax Code</label>
                  <div className="relative">
                    <select className="w-full bg-white border border-[var(--border)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-sm appearance-none cursor-pointer">
                      <option>Standard Rated (15%)</option>
                      <option>Zero Rate (0%)</option>
                      <option>Out of Scope</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-[var(--text-secondary)] pointer-events-none" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-[var(--text-primary)]">VAT Inclusive</label>
                  <div className="flex items-center h-[40px] px-2 gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-[var(--border-strong)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                    </label>
                    <span className="text-[14px] text-[var(--text-primary)]">Yes</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-[13px] font-semibold text-[var(--text-primary)]">Notes (Optional)</label>
                <textarea 
                  placeholder="Add any notes..." 
                  className="w-full bg-white border border-[var(--border)] rounded-md px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-sm min-h-[80px]"
                ></textarea>
              </div>

              {/* Accounting Treatment Summary Box */}
              <div className="bg-[var(--surface-subtle)] border border-[var(--border)] rounded-lg p-4 text-[13px] mt-4">
                <div className="font-semibold text-[var(--text-secondary)] mb-2 text-[11px] uppercase tracking-wide">Accounting Treatment</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex gap-2"><span className="text-[var(--text-muted)] w-16">Type</span><span className="font-medium text-[var(--danger)]">Expense</span></div>
                  <div className="flex gap-2"><span className="text-[var(--text-muted)] w-16">Direction</span><span className="font-medium">Outflow</span></div>
                  <div className="flex gap-2"><span className="text-[var(--text-muted)] w-16">Profit</span><span className="font-medium text-[var(--danger)]">Reduces profit</span></div>
                  <div className="flex gap-2"><span className="text-[var(--text-muted)] w-16">VAT</span><span className="font-medium">Standard Rated (15%)</span></div>
                </div>
              </div>

            </form>
          </div>
        </div>

        {/* Floating Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 sm:absolute sm:right-0 sm:left-auto sm:w-[60%] bg-white border-t border-[var(--border)] p-4 sm:px-12 flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
          <button className="px-5 py-2.5 rounded-md text-[14px] font-medium text-[var(--text-secondary)] border border-[var(--border-strong)] hover:bg-[var(--surface-subtle)] transition-colors">
            Cancel
          </button>
          <button className="px-5 py-2.5 rounded-md text-[14px] font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] shadow-sm transition-colors">
            Save Transaction
          </button>
        </div>

      </div>
    </AppShell>
  );
}

function ConfidenceItem({ label, value, level, isSuggested }: any) {
  return (
    <div className="flex justify-between items-center text-[13px] border-b border-[var(--border)] pb-2 last:border-0">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
          {value}
          {isSuggested && <span className="hidden sm:inline text-[10px] font-normal uppercase bg-[var(--primary-subtle)] text-[var(--primary)] px-1.5 py-0.5 rounded">Suggested</span>}
        </span>
        {level === 'high' ? (
          <span className="hidden sm:flex items-center gap-1 text-[11px] text-[var(--success)] font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> High confidence
          </span>
        ) : (
          <span className="hidden sm:flex items-center gap-1 text-[11px] text-[var(--warning)] font-medium">
            <AlertCircle className="w-3.5 h-3.5" /> Review suggested
          </span>
        )}
      </div>
    </div>
  );
}
