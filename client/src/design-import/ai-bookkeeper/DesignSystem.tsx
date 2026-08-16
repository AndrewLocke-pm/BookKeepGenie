import React from "react";
import "./_group.css";

export default function DesignSystem() {
  const colors = [
    { name: "--sidebar", hex: "#0c1a3a" },
    { name: "--sidebar-hover", hex: "#162a55" },
    { name: "--sidebar-active", hex: "#1e3a8a" },
    { name: "--page-bg", hex: "#f5f7fa" },
    { name: "--surface", hex: "#ffffff" },
    { name: "--surface-subtle", hex: "#f9fafb" },
    { name: "--text-primary", hex: "#101828" },
    { name: "--text-secondary", hex: "#475569" },
    { name: "--text-muted", hex: "#94a3b8" },
    { name: "--border", hex: "#e2e8f0" },
    { name: "--border-strong", hex: "#cbd5e1" },
    { name: "--primary", hex: "#4f46e5" },
    { name: "--primary-hover", hex: "#4338ca" },
    { name: "--primary-subtle", hex: "#eef2ff" },
    { name: "--success", hex: "#16a34a" },
    { name: "--success-subtle", hex: "#f0fdf4" },
    { name: "--danger", hex: "#dc2626" },
    { name: "--danger-subtle", hex: "#fef2f2" },
    { name: "--warning", hex: "#d97706" },
    { name: "--warning-subtle", hex: "#fffbeb" },
    { name: "--violet", hex: "#7c3aed" },
    { name: "--violet-subtle", hex: "#f5f3ff" },
  ];

  return (
    <div className="min-h-screen bg-[var(--page-bg)] p-12 font-sans text-[var(--text-primary)]">
      <div className="max-w-5xl mx-auto space-y-16">
        
        <header>
          <h1 className="text-[28px] font-bold leading-tight mb-2">Design System — AI Bookkeeper</h1>
          <p className="text-[var(--text-secondary)]">Styles, components, and patterns used across the application.</p>
        </header>

        <section>
          <h2 className="text-[18px] font-bold border-b border-[var(--border)] pb-2 mb-6">Color Palette</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {colors.map((c) => (
              <div key={c.name} className="flex flex-col gap-2">
                <div 
                  className="w-full h-20 rounded-md border border-[var(--border)] shadow-sm"
                  style={{ backgroundColor: `var(${c.name})` }}
                />
                <div className="text-[13px]">
                  <div className="font-bold">{c.name}</div>
                  <div className="text-[var(--text-secondary)] font-mono text-[11px]">{c.hex}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[18px] font-bold border-b border-[var(--border)] pb-2 mb-6">Typography</h2>
          <div className="space-y-8 bg-white p-8 rounded-xl border border-[var(--border)] shadow-sm">
            <div>
              <div className="text-[var(--text-muted)] text-[12px] font-bold uppercase mb-2">Page Headings</div>
              <div className="text-[28px] font-bold">The quick brown fox jumps over the lazy dog</div>
              <div className="text-[var(--text-secondary)] text-[13px] mt-1 font-mono">28px / 700 / Inter</div>
            </div>
            <div>
              <div className="text-[var(--text-muted)] text-[12px] font-bold uppercase mb-2">Metric Values</div>
              <div className="text-[26px] font-bold tabular-nums">R125,430.00</div>
              <div className="text-[var(--text-secondary)] text-[13px] mt-1 font-mono">26px / 700 / Inter / tabular-nums</div>
            </div>
            <div>
              <div className="text-[var(--text-muted)] text-[12px] font-bold uppercase mb-2">Body Text</div>
              <div className="text-[14px] leading-relaxed max-w-2xl">
                We noticed this transaction may represent money you put into the business rather than normal business revenue. Does not affect profit.
              </div>
              <div className="text-[var(--text-secondary)] text-[13px] mt-1 font-mono">14px / 400 / Inter</div>
            </div>
            <div>
              <div className="text-[var(--text-muted)] text-[12px] font-bold uppercase mb-2">Table Text</div>
              <div className="text-[13px]">29 Apr 2024 • Builders Warehouse • Plumbing Supplies</div>
              <div className="text-[var(--text-secondary)] text-[13px] mt-1 font-mono">13px / 400 / Inter</div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[18px] font-bold border-b border-[var(--border)] pb-2 mb-6">Amounts & Currency</h2>
          <div className="flex gap-12 bg-white p-8 rounded-xl border border-[var(--border)] shadow-sm">
            <div>
              <div className="text-[var(--text-muted)] text-[12px] font-bold uppercase mb-2">Positive (Income)</div>
              <div className="text-[14px] font-medium text-[var(--success)] tabular-nums">R45,000.00</div>
            </div>
            <div>
              <div className="text-[var(--text-muted)] text-[12px] font-bold uppercase mb-2">Negative (Expense)</div>
              <div className="text-[14px] font-medium text-[var(--text-primary)] tabular-nums">-R1,250.00</div>
            </div>
            <div>
              <div className="text-[var(--text-muted)] text-[12px] font-bold uppercase mb-2">Neutral</div>
              <div className="text-[14px] font-medium text-[var(--text-secondary)] tabular-nums">R0.00</div>
            </div>
            <div>
              <div className="text-[var(--text-muted)] text-[12px] font-bold uppercase mb-2">Equity / Liability</div>
              <div className="text-[14px] font-medium text-[var(--warning)] tabular-nums">R50,000.00</div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[18px] font-bold border-b border-[var(--border)] pb-2 mb-6">Badges & Tags</h2>
          <div className="bg-white p-8 rounded-xl border border-[var(--border)] shadow-sm space-y-8">
            <div>
              <div className="text-[var(--text-muted)] text-[12px] font-bold uppercase mb-4">Status Badges</div>
              <div className="flex gap-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-[var(--success-subtle)] text-[var(--success)] border border-[var(--success)]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)]"></div> Active
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-[var(--warning-subtle)] text-[var(--warning)] border border-[var(--warning)]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--warning)]"></div> Pending
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-strong)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]"></div> Draft
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger)]/20">
                  Overdue
                </span>
              </div>
            </div>
            
            <div>
              <div className="text-[var(--text-muted)] text-[12px] font-bold uppercase mb-4">Category Badges</div>
              <div className="flex flex-wrap gap-4">
                <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-[var(--success-subtle)] text-[var(--success)]">Income</span>
                <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border)]">Expense</span>
                <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-[var(--warning-subtle)] text-[var(--warning)]">Capital</span>
                <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-[var(--warning-subtle)] text-[var(--warning)]">Owner Loan</span>
                <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-slate-100 text-slate-700">Transfer</span>
                <span className="inline-flex px-2 py-0.5 rounded text-[12px] font-medium bg-[var(--danger-subtle)] text-[var(--danger)]">Tax Payment</span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[18px] font-bold border-b border-[var(--border)] pb-2 mb-6">Buttons</h2>
          <div className="bg-white p-8 rounded-xl border border-[var(--border)] shadow-sm flex flex-col gap-6">
            <div className="flex gap-4 items-center">
              <button className="bg-[var(--primary)] text-white px-4 py-2 rounded-md font-medium text-[14px] hover:bg-[var(--primary-hover)] transition-colors shadow-sm">Primary Button</button>
              <button className="bg-white border border-[var(--border-strong)] text-[var(--text-primary)] px-4 py-2 rounded-md font-medium text-[14px] hover:bg-[var(--surface-subtle)] transition-colors shadow-sm">Secondary Button</button>
              <button className="bg-[var(--danger)] text-white px-4 py-2 rounded-md font-medium text-[14px] hover:bg-red-700 transition-colors shadow-sm">Destructive</button>
              <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] px-4 py-2 rounded-md font-medium text-[14px] transition-colors">Ghost Button</button>
            </div>
          </div>
        </section>
        
      </div>
    </div>
  );
}
