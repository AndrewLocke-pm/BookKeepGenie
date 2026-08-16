import React, { useState } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  BookOpen,
  Tags,
  Receipt,
  PieChart,
  Scale,
  Activity,
  FileSpreadsheet,
  LineChart,
  Briefcase,
  FileText,
  Users,
  Settings,
  HelpCircle,
  Bell,
  ChevronDown,
  Building,
  Landmark,
  Menu,
  X
} from "lucide-react";
import { organisation, user } from "./MockData";
import "../_group.css";

interface AppShellProps {
  children: React.ReactNode;
  activePage?: string;
}

export function AppShell({ children, activePage = "Dashboard" }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navGroups = [
    {
      label: "",
      items: [
        { label: "Dashboard", icon: LayoutDashboard }
      ]
    },
    {
      label: "TRANSACTIONS",
      items: [
        { label: "Add Transaction", icon: PlusCircle },
        { label: "Ledger", icon: BookOpen },
        { label: "Categories", icon: Tags },
        { label: "Receipts", icon: Receipt },
      ]
    },
    {
      label: "REPORTS",
      items: [
        { label: "Profit & Loss", icon: PieChart },
        { label: "Balance Sheet", icon: Scale },
        { label: "Cash Flow", icon: Activity },
        { label: "Trial Balance", icon: FileSpreadsheet },
        { label: "Management Accounts", icon: LineChart },
      ]
    },
    {
      label: "TAX",
      items: [
        { label: "Tax Overview", icon: Landmark },
        { label: "VAT201", icon: FileText },
        { label: "IRP6", icon: Briefcase },
        { label: "Tax Profiles", icon: Settings },
      ]
    },
    {
      label: "ORGANISATION",
      items: [
        { label: "Organisations", icon: Building },
        { label: "Members", icon: Users },
        { label: "Settings", icon: Settings },
      ]
    }
  ];

  const NavContent = () => (
    <>
      {/* Logo Area */}
      <div className="p-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-md bg-[var(--primary)] flex items-center justify-center flex-shrink-0 text-white shadow-sm">
            <span className="font-bold text-sm">AI</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-white text-[15px] leading-tight">AI Bookkeeper</span>
            <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">South Africa</span>
          </div>
        </div>
        <button className="sm:hidden text-[var(--text-muted)] hover:text-white" onClick={() => setDrawerOpen(false)}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6 scrollbar-hide">
        {navGroups.map((group, idx) => (
          <div key={idx}>
            {group.label && (
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-3">
                {group.label}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = activePage === item.label;
                return (
                  <button
                    key={item.label}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[15px] font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--sidebar-active)] text-white"
                        : "text-[var(--text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-white"
                    }`}
                  >
                    <item.icon className={`w-[18px] h-[18px] ${isActive ? "text-white" : "text-[var(--text-muted)]"}`} strokeWidth={2} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User Area */}
      <div className="p-4 border-t border-[var(--sidebar-hover)]">
        <div className="flex items-center gap-3 hover:bg-[var(--sidebar-hover)] p-2 -mx-2 rounded-md cursor-pointer transition-colors">
          <div className="w-9 h-9 rounded-full bg-[var(--primary-hover)] text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
            {user.initials}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-[14px] font-semibold text-white truncate">{user.name}</span>
            <span className="text-[13px] text-[var(--text-muted)] truncate">{user.role}</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden text-[var(--text-primary)] bg-[var(--page-bg)] font-sans antialiased">
      
      {/* Desktop Sidebar */}
      <div className="hidden sm:flex w-[240px] flex-shrink-0 flex-col h-full bg-[var(--sidebar)] text-[var(--text-muted)] border-r border-[var(--sidebar-hover)]">
        <NavContent />
      </div>

      {/* Mobile Backdrop */}
      {drawerOpen && (
        <div className="sm:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setDrawerOpen(false)} />
      )}

      {/* Mobile Drawer */}
      <div className={`sm:hidden fixed inset-y-0 left-0 z-50 w-[240px] flex flex-col h-full bg-[var(--sidebar)] text-[var(--text-muted)] transition-transform duration-200 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <NavContent />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar */}
        <div className="h-[64px] flex-shrink-0 bg-white border-b border-[var(--border)] flex items-center justify-between px-4 sm:px-6 z-10">
          
          <div className="flex items-center gap-2">
            <button className="sm:hidden mr-3" onClick={() => setDrawerOpen(true)}>
              <Menu className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
            <span className="hidden sm:inline text-[13px] text-[var(--text-secondary)]">Organisation:</span>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-[var(--surface-subtle)] transition-colors border border-transparent hover:border-[var(--border)]">
              <span className="text-[15px] font-bold text-[var(--text-primary)]">{organisation.name}</span>
              <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <HelpCircle className="w-5 h-5" />
            </button>
            <button className="relative text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--danger)] text-white text-[10px] font-bold flex items-center justify-center">
                1
              </span>
            </button>
            <div className="w-px h-6 bg-[var(--border)] mx-1"></div>
            <button className="flex items-center gap-2 hover:bg-[var(--surface-subtle)] py-1 pl-3 pr-2 rounded-full transition-colors border border-transparent hover:border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">{user.name}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{user.role}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-[var(--primary-subtle)] text-[var(--primary)] flex items-center justify-center font-bold text-xs">
                  {user.initials}
                </div>
              </div>
            </button>
          </div>

        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-[var(--page-bg)]">
          {children}
        </div>

      </div>
    </div>
  );
}
