import { useState } from 'react';
import { Link } from 'wouter';
import { SignOutButton } from '@clerk/clerk-react';
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
  X,
  Check,
  LogOut,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useOrganisation } from '@/context/organisation-context';

interface BookkeeperPreviewShellProps {
  children: React.ReactNode;
  activePage?: string;
}

const navGroups = [
  {
    label: '',
    items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/', testId: 'link-dashboard' }],
  },
  {
    label: 'TRANSACTIONS',
    items: [
      { label: 'Add Transaction', icon: PlusCircle, href: '/upload', testId: 'link-process-transaction' },
      { label: 'Ledger', icon: BookOpen, href: '/ledger', testId: 'link-transactions' },
      { label: 'Categories', icon: Tags, href: '/categories', testId: 'link-categories' },
      { label: 'Receipts', icon: Receipt, href: '/receipts', testId: 'link-receipts' },
    ],
  },
  {
    label: 'REPORTS',
    items: [
      { label: 'Profit & Loss', icon: PieChart, href: '/reports/profit-loss', testId: 'link-financial-reports' },
      { label: 'Balance Sheet', icon: Scale, href: '/reports/balance-sheet', testId: 'link-balance-sheet' },
      { label: 'Cash Flow', icon: Activity, href: '/reports/cash-flow', testId: 'link-cash-flow' },
      { label: 'Trial Balance', icon: FileSpreadsheet, href: '/reports/trial-balance', testId: 'link-trial-balance' },
      { label: 'Management Accounts', icon: LineChart, href: '/reports/management-accounts', testId: 'link-management' },
    ],
  },
  {
    label: 'TAX',
    items: [
      { label: 'Tax Overview', icon: Landmark, href: '/tax', testId: 'link-tax-overview' },
      { label: 'VAT201', icon: FileText, href: '/vat201', testId: 'link-vat201-returns' },
      { label: 'IRP6', icon: Briefcase, href: '/irp6', testId: 'link-irp6-provisional-tax' },
      { label: 'Tax Profiles', icon: Settings, href: '/tax-settings', testId: 'link-tax-settings' },
    ],
  },
  {
    label: 'ORGANISATION',
    items: [
      { label: 'Organisations', icon: Building, href: '/organisations', testId: 'link-organisations' },
      { label: 'Members', icon: Users, href: '/members', testId: 'link-members' },
      { label: 'Settings', icon: Settings, href: '/settings', testId: 'link-settings' },
    ],
  },
];

function UserMenuContent() {
  const { user } = useAuth();
  return (
    <DropdownMenuContent align="end" className="w-56">
      <div className="px-3 py-2 border-b border-border mb-1">
        <p className="text-sm font-medium">{user?.fullName || 'User'}</p>
        <p className="text-xs text-muted-foreground truncate">
          {user?.primaryEmailAddress?.emailAddress}
        </p>
      </div>
      <DropdownMenuItem asChild>
        <Link href="/settings" className="cursor-pointer" data-testid="menu-item-settings">
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <SignOutButton>
        <DropdownMenuItem className="cursor-pointer" data-testid="button-logout">
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </SignOutButton>
    </DropdownMenuContent>
  );
}

function OrgSelector() {
  const { organisations, selectedOrg, selectedOrgId, setSelectedOrgId } = useOrganisation();
  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline text-[13px] text-[var(--bk-text-secondary)]">Organisation:</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-[var(--bk-surface-subtle)] transition-colors border border-transparent hover:border-[var(--bk-border)]"
            data-testid="button-org-selector"
          >
            <span className="text-[15px] font-bold text-[var(--bk-text-primary)]">
              {selectedOrg?.name ?? 'Personal Workspace'}
            </span>
            <ChevronDown className="w-4 h-4 text-[var(--bk-text-secondary)]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Organisations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {organisations.length === 0 && (
            <div className="px-2 py-1.5">
              <p className="text-xs text-muted-foreground mb-2">
                No organisations yet — you're using your personal workspace.
              </p>
            </div>
          )}
          {organisations.map(org => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => setSelectedOrgId(org.id)}
              className="flex items-center gap-2 cursor-pointer"
              data-testid={`org-item-${org.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{org.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{org.userRole}</div>
              </div>
              {selectedOrgId === org.id && <Check className="w-4 h-4 text-primary shrink-0" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/organisations" className="cursor-pointer text-primary text-sm">
              Manage organisations
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function BookkeeperPreviewShell({ children, activePage = 'Dashboard' }: BookkeeperPreviewShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useAuth();
  const { selectedOrg } = useOrganisation();

  const initials =
    ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')).toUpperCase() ||
    user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
    'U';
  const displayName = user?.fullName || user?.firstName || 'User';
  const role = selectedOrg?.userRole ?? 'Member';

  const NavContent = () => (
    <>
      {/* Logo area */}
      <div className="p-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-md bg-[var(--bk-primary)] flex items-center justify-center flex-shrink-0 text-white shadow-sm">
            <span className="font-bold text-sm">AI</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-white text-[15px] leading-tight">AI Bookkeeper</span>
            <span className="text-[11px] text-[var(--bk-text-muted)] uppercase tracking-wider font-semibold">South Africa</span>
          </div>
        </div>
        <button
          className="sm:hidden text-[var(--bk-text-muted)] hover:text-white"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close menu"
          data-testid="button-close-drawer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {navGroups.map((group, idx) => (
          <div key={idx}>
            {group.label && (
              <div className="text-[10px] font-bold text-[var(--bk-text-muted)] uppercase tracking-wider mb-2 px-3">
                {group.label}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map(item => {
                const isActive = activePage === item.label;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    data-testid={item.testId}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[15px] font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--bk-sidebar-active)] text-white'
                        : 'text-[var(--bk-text-muted)] hover:bg-[var(--bk-sidebar-hover)] hover:text-white'
                    }`}
                  >
                    <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-white' : 'text-[var(--bk-text-muted)]'}`} strokeWidth={2} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Compact identity footer — opens the same user menu */}
      <div className="p-4 border-t border-[var(--bk-sidebar-hover)]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-full flex items-center gap-3 hover:bg-[var(--bk-sidebar-hover)] p-2 -mx-2 rounded-md cursor-pointer transition-colors text-left"
              data-testid="button-sidebar-user"
            >
              <div className="w-9 h-9 rounded-full bg-[var(--bk-primary-hover)] text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                {initials}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[14px] font-semibold text-white truncate">{displayName}</span>
                <span className="text-[13px] text-[var(--bk-text-muted)] truncate capitalize">{role}</span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <UserMenuContent />
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden text-[var(--bk-text-primary)] bg-[var(--bk-page-bg)] font-sans antialiased">
      {/* Desktop sidebar */}
      <div className="hidden sm:flex w-[240px] flex-shrink-0 flex-col h-full bg-[var(--bk-sidebar)] text-[var(--bk-text-muted)] border-r border-[var(--bk-sidebar-hover)]">
        <NavContent />
      </div>

      {/* Mobile backdrop */}
      {drawerOpen && (
        <div className="sm:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setDrawerOpen(false)} />
      )}

      {/* Mobile drawer */}
      <div className={`sm:hidden fixed inset-y-0 left-0 z-50 w-[240px] flex flex-col h-full bg-[var(--bk-sidebar)] text-[var(--bk-text-muted)] transition-transform duration-200 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <NavContent />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <div className="h-[64px] flex-shrink-0 bg-white border-b border-[var(--bk-border)] flex items-center justify-between px-4 sm:px-6 z-10">
          <div className="flex items-center gap-2">
            <button
              className="sm:hidden mr-3"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              data-testid="button-open-drawer"
            >
              <Menu className="w-5 h-5 text-[var(--bk-text-secondary)]" />
            </button>
            <OrgSelector />
          </div>

          <div className="flex items-center gap-4">
            <button
              className="text-[var(--bk-text-secondary)] hover:text-[var(--bk-text-primary)] transition-colors"
              aria-label="Help"
              data-testid="button-help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              className="relative text-[var(--bk-text-secondary)] hover:text-[var(--bk-text-primary)] transition-colors"
              aria-label="Notifications"
              data-testid="button-notifications"
            >
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-[var(--bk-border)] mx-1"></div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 hover:bg-[var(--bk-surface-subtle)] py-1 pl-3 pr-2 rounded-full transition-colors border border-transparent hover:border-[var(--bk-border)]"
                  data-testid="button-user-menu"
                >
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex flex-col items-end">
                      <span className="text-[13px] font-semibold text-[var(--bk-text-primary)]">{displayName}</span>
                      <span className="text-[11px] text-[var(--bk-text-muted)] capitalize">{role}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[var(--bk-primary-subtle)] text-[var(--bk-primary)] flex items-center justify-center font-bold text-xs">
                      {initials}
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <UserMenuContent />
            </DropdownMenu>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto bg-[var(--bk-page-bg)]">
          {children}
        </div>
      </div>
    </div>
  );
}
