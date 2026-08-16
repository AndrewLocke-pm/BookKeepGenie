import React from "react";
import { AppShell } from "./_shared/AppShell";
import { organisation } from "./_shared/MockData";
import { 
  Upload, 
  Plus,
  Briefcase,
  Users,
  ChevronDown
} from "lucide-react";
import "./_group.css";

export default function DashboardEmpty() {
  return (
    <AppShell activePage="Dashboard">
      <div className="p-4 sm:p-8 max-w-[1536px] mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-bold text-[var(--text-primary)] leading-tight">Welcome to AI Bookkeeper, John.</h1>
            <p className="text-[14px] text-[var(--text-secondary)] mt-1">Let's set up {organisation.name} and record your first transaction.</p>
          </div>
          <button className="hidden sm:flex items-center gap-2 bg-white border border-[var(--border)] rounded-md px-4 py-2 text-[14px] font-medium shadow-sm hover:bg-[var(--surface-subtle)] transition-colors">
            <span className="text-[var(--text-primary)]">Apr 2024</span>
            <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Metrics Row (Zeroed) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard title="Revenue" value="R0.00" />
          <MetricCard title="Expenses" value="R0.00" />
          <MetricCard title="Net Profit" value="R0.00" />
          <MetricCard title="Transactions" value="0" />
        </div>

        {/* Getting Started Panel */}
        <div className="bg-white border border-[var(--border)] rounded-xl shadow-sm p-6 sm:p-10 max-w-3xl w-full mx-auto mt-12">
          <div className="text-center mb-8">
            <h2 className="text-[24px] font-bold text-[var(--text-primary)] mb-2">Get started</h2>
            <p className="text-[14px] text-[var(--text-secondary)]">Complete these steps to unlock the full power of your automated bookkeeping.</p>
          </div>

          <div className="mb-8">
            <div className="flex justify-between text-[12px] font-medium text-[var(--text-secondary)] mb-2">
              <span>Setup progress: 0 of 4 complete</span>
            </div>
            <div className="h-1.5 w-full bg-[var(--surface-subtle)] border border-[var(--border)] rounded-full overflow-hidden">
              <div className="h-full bg-slate-300 w-0"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <StepCard 
              number={1} 
              title="Add your first transaction" 
              description="Record income or an expense manually, or describe it in plain English."
              icon={Plus}
              buttonText="Add First Transaction"
              primary={true}
            />

            <StepCard 
              number={2} 
              title="Upload a receipt" 
              description="Let AI extract the vendor, date, amount and suggested category."
              icon={Upload}
              buttonText="Upload Receipt"
            />

            <StepCard 
              number={3} 
              title="Complete your tax profile" 
              description="Configure VAT registration and provisional-tax information."
              icon={Briefcase}
              buttonText="Set Up Tax Profile"
            />

            <StepCard 
              number={4} 
              title="Invite a team member" 
              description="Add your bookkeeper, accountant or business partner."
              icon={Users}
              buttonText="Invite Member"
            />

          </div>
        </div>

      </div>
    </AppShell>
  );
}

function MetricCard({ title, value }: { title: string, value: string }) {
  return (
    <div className="bg-white border border-[var(--border)] p-4 sm:p-6 rounded-xl shadow-sm flex flex-col">
      <div className="text-[13px] font-medium text-[var(--text-secondary)] mb-2">{title}</div>
      <div className="text-[22px] sm:text-[28px] font-bold tabular-nums mb-3 text-[var(--text-secondary)]">
        {value}
      </div>
      <div className="mt-auto">
        <span className="text-[12px] text-[var(--text-muted)]">No data yet</span>
      </div>
    </div>
  );
}

function StepCard({ number, title, description, icon: Icon, buttonText, primary = false }: any) {
  return (
    <div className="border border-[var(--border)] rounded-xl p-6 flex flex-col items-start hover:border-[var(--border-strong)] transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-[var(--primary-subtle)] text-[var(--primary)] flex items-center justify-center font-bold text-[14px]">
          {number}
        </div>
        <h3 className="text-[15px] font-bold text-[var(--text-primary)]">{title}</h3>
      </div>
      <p className="text-[13px] text-[var(--text-secondary)] mb-6 leading-relaxed flex-1">
        {description}
      </p>
      <button className={`w-full py-2 px-4 rounded-md text-[13px] font-medium transition-colors ${
        primary 
          ? "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]" 
          : "bg-white border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
      }`}>
        {buttonText}
      </button>
    </div>
  );
}
