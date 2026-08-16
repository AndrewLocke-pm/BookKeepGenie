import { SignOutButton } from '@clerk/clerk-react';
import {
  Home,
  LayoutList,
  Plus,
  Tag,
  Receipt,
  TrendingUp,
  Scale,
  ArrowLeftRight,
  Equal,
  BarChart3,
  FileSearch,
  FileSpreadsheet,
  Calculator,
  Settings,
  Building2,
  Users,
  Settings2,
  LogOut,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  testId: string;
  match?: (loc: string) => boolean;
}

const mainItems: NavItem[] = [
  { title: 'Dashboard', url: '/', icon: Home, testId: 'link-dashboard', match: loc => loc === '/' },
];

const transactionItems: NavItem[] = [
  { title: 'Add Transaction', url: '/upload', icon: Plus, testId: 'link-process-transaction' },
  {
    title: 'Ledger',
    url: '/ledger',
    icon: LayoutList,
    testId: 'link-transactions',
    match: loc => loc === '/ledger' || loc === '/transactions',
  },
  { title: 'Categories', url: '/categories', icon: Tag, testId: 'link-categories' },
  { title: 'Receipts', url: '/receipts', icon: Receipt, testId: 'link-receipts' },
];

const reportItems: NavItem[] = [
  {
    title: 'Profit & Loss',
    url: '/reports/profit-loss',
    icon: TrendingUp,
    testId: 'link-financial-reports',
    match: loc => loc === '/reports' || loc === '/reports/profit-loss',
  },
  {
    title: 'Balance Sheet',
    url: '/reports/balance-sheet',
    icon: Scale,
    testId: 'link-balance-sheet',
    match: loc => loc === '/reports/balance-sheet',
  },
  {
    title: 'Cash Flow',
    url: '/reports/cash-flow',
    icon: ArrowLeftRight,
    testId: 'link-cash-flow',
    match: loc => loc === '/reports/cash-flow',
  },
  {
    title: 'Trial Balance',
    url: '/reports/trial-balance',
    icon: Equal,
    testId: 'link-trial-balance',
    match: loc => loc === '/reports/trial-balance',
  },
  {
    title: 'Management',
    url: '/reports/management-accounts',
    icon: BarChart3,
    testId: 'link-management',
    match: loc => loc === '/reports/management-accounts',
  },
];

const taxItems: NavItem[] = [
  { title: 'Tax Overview', url: '/tax', icon: FileSearch, testId: 'link-tax-overview' },
  { title: 'VAT201 Returns', url: '/vat201', icon: FileSpreadsheet, testId: 'link-vat201-returns' },
  { title: 'IRP6 Provisional', url: '/irp6', icon: Calculator, testId: 'link-irp6-provisional-tax' },
  { title: 'Tax Profiles', url: '/tax-settings', icon: Settings, testId: 'link-tax-settings' },
];

const orgItems: NavItem[] = [
  { title: 'Organisations', url: '/organisations', icon: Building2, testId: 'link-organisations' },
  { title: 'Members', url: '/members', icon: Users, testId: 'link-members' },
  { title: 'Settings', url: '/settings', icon: Settings2, testId: 'link-settings' },
];

function NavGroup({ label, items, location }: { label: string; items: NavItem[]; location: string }) {
  return (
    <SidebarGroup className="py-0 mb-1">
      <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50 px-3 py-1.5 mb-0.5">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(item => {
            const isActive = item.match ? item.match(location) : location === item.url;
            return (
              <SidebarMenuItem key={item.title} className="mb-0.5">
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className="px-3 py-1.5 h-8 text-[13px] rounded-md"
                >
                  <Link href={item.url} data-testid={item.testId}>
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const initials =
    ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')).toUpperCase() ||
    user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
    'U';

  return (
    <Sidebar>
      {/* Logo header */}
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-3 py-3">
          <div className="w-7 h-7 bg-primary rounded flex items-center justify-center shrink-0">
            <BarChart3 className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-sidebar-accent-foreground leading-tight">
              AI Bookkeeper
            </div>
            <div className="text-[11px] text-sidebar-foreground leading-tight">South Africa</div>
          </div>
        </div>
      </SidebarHeader>

      {/* Navigation — hide native scrollbar */}
      <SidebarContent className="py-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {/* Dashboard alone, no label */}
        <SidebarGroup className="py-0 mb-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map(item => {
                const isActive = item.match ? item.match(location) : location === item.url;
                return (
                  <SidebarMenuItem key={item.title} className="mb-0.5">
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="px-3 py-1.5 h-8 text-[13px] rounded-md"
                    >
                      <Link href={item.url} data-testid={item.testId}>
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <NavGroup label="Transactions" items={transactionItems} location={location} />
        <NavGroup label="Reports" items={reportItems} location={location} />
        <NavGroup label="Tax" items={taxItems} location={location} />
        <NavGroup label="Organisation" items={orgItems} location={location} />
      </SidebarContent>

      {/* User footer */}
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <div className="flex items-center gap-2.5 px-1 py-1.5 rounded-md">
          <Avatar className="w-7 h-7 shrink-0">
            {user?.imageUrl && <AvatarImage src={user.imageUrl} alt={user.fullName || 'User'} />}
            <AvatarFallback className="text-[10px] font-semibold bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-sidebar-accent-foreground truncate leading-tight">
              {user?.fullName || user?.firstName || 'User'}
            </p>
            <p className="text-[11px] text-sidebar-foreground truncate leading-tight">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
          <SignOutButton>
            <button
              data-testid="button-logout"
              className="shrink-0 p-1 text-sidebar-foreground hover:text-sidebar-accent-foreground rounded transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </SignOutButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
