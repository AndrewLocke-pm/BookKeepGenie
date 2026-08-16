import { ClerkProvider } from '@clerk/clerk-react';
import { Switch, Route, useLocation } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useAuth } from '@/hooks/useAuth';
import { OrganisationProvider, useOrganisation } from '@/context/organisation-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Bell, HelpCircle, ChevronDown, Check, Building2 } from 'lucide-react';

import NotFound from '@/pages/not-found';
import Landing from '@/pages/landing';
import Dashboard from '@/pages/dashboard';
import Upload from '@/pages/upload';
import Ledger from '@/pages/ledger';
import TransactionDetail from '@/pages/transaction-detail';
import Categories from '@/pages/categories';
import Receipts from '@/pages/receipts';
import Reports from '@/pages/reports';
import TaxOverview from '@/pages/tax-overview';
import TaxSettings from '@/pages/tax-settings';
import Vat201 from '@/pages/vat201';
import Irp6 from '@/pages/irp6';
import Organisations from '@/pages/organisations';
import Members from '@/pages/members';
import Settings from '@/pages/settings';
import DashboardPreview from '@/pages/ui-preview/dashboard-preview';
import AddTransactionPreview from '@/pages/ui-preview/add-transaction-preview';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function OrgSelector() {
  const { organisations, selectedOrg, selectedOrgId, setSelectedOrgId } = useOrganisation();

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-muted-foreground hidden sm:inline">Organisation</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-1.5 text-sm font-medium text-foreground border border-border rounded-md px-2.5 py-1.5 bg-white hover:border-primary/40 transition-colors"
            data-testid="button-org-selector"
          >
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            {selectedOrg?.name ?? 'Personal Workspace'}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
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
            <a href="/organisations" className="cursor-pointer text-primary text-sm">
              Manage organisations
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function UserMenu() {
  const { user } = useAuth();
  const { selectedOrg } = useOrganisation();
  const initials =
    ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')).toUpperCase() ||
    user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
    'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2.5 hover:opacity-80 transition-opacity outline-none">
          <Avatar className="w-8 h-8 border border-border">
            {user?.imageUrl && <AvatarImage src={user.imageUrl} alt={user.fullName || 'User'} />}
            <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden lg:block text-left">
            <div className="text-sm font-semibold text-foreground leading-tight line-clamp-1">
              {user?.fullName || user?.firstName || 'User'}
            </div>
            <div className="text-xs text-muted-foreground leading-tight capitalize">
              {selectedOrg?.userRole ?? 'Member'}
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden lg:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2 border-b border-border mb-1">
          <p className="text-sm font-medium">{user?.fullName || 'User'}</p>
          <p className="text-xs text-muted-foreground truncate">
            {user?.primaryEmailAddress?.emailAddress}
          </p>
        </div>
        <DropdownMenuItem asChild>
          <a href="/settings" className="cursor-pointer">Settings</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppHeader() {
  return (
    <header className="h-16 border-b border-border bg-white flex items-center justify-between px-5 shrink-0 gap-4 z-10">
      <div className="flex items-center gap-3">
        <SidebarTrigger
          data-testid="button-sidebar-toggle"
          className="text-muted-foreground hover:text-foreground"
        />
        <OrgSelector />
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="text-muted-foreground hidden md:flex" aria-label="Help">
          <HelpCircle className="w-4.5 h-4.5" />
        </Button>
        <div className="relative hidden md:block">
          <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Notifications">
            <Bell className="w-4.5 h-4.5" />
          </Button>
        </div>
        <div className="w-px h-5 bg-border mx-1 hidden md:block" />
        <UserMenu />
      </div>
    </header>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return <Landing />;

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/upload" component={Upload} />
      <Route path="/ledger" component={Ledger} />
      <Route path="/transactions" component={Ledger} />
      <Route path="/transactions/:id" component={TransactionDetail} />
      <Route path="/categories" component={Categories} />
      <Route path="/receipts" component={Receipts} />
      <Route path="/reports" component={Reports} />
      <Route path="/reports/profit-loss" component={Reports} />
      <Route path="/reports/balance-sheet" component={Reports} />
      <Route path="/reports/cash-flow" component={Reports} />
      <Route path="/reports/trial-balance" component={Reports} />
      <Route path="/reports/management-accounts" component={Reports} />
      <Route path="/tax" component={TaxOverview} />
      <Route path="/vat201" component={Vat201} />
      <Route path="/irp6" component={Irp6} />
      <Route path="/tax-settings" component={TaxSettings} />
      <Route path="/organisations" component={Organisations} />
      <Route path="/members" component={Members} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PreviewRouter() {
  return (
    <Switch>
      <Route path="/ui-preview/dashboard" component={DashboardPreview} />
      <Route path="/ui-preview/add-transaction" component={AddTransactionPreview} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const isPreviewRoute = location.startsWith('/ui-preview');

  const sidebarStyle = {
    '--sidebar-width': '13.5rem',
    '--sidebar-width-icon': '3rem',
  } as React.CSSProperties;

  if (!isLoading && isAuthenticated && isPreviewRoute) {
    return (
      <>
        <OrganisationProvider>
          <PreviewRouter />
        </OrganisationProvider>
        <Toaster />
      </>
    );
  }

  return (
    <>
      {!isLoading && isAuthenticated ? (
        <OrganisationProvider>
          <SidebarProvider style={sidebarStyle}>
            <div className="flex h-screen w-full bg-slate-50">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                <AppHeader />
                <main className="flex-1 overflow-auto">
                  <div className="p-6 md:p-7">
                    <Router />
                  </div>
                </main>
              </div>
            </div>
          </SidebarProvider>
        </OrganisationProvider>
      ) : (
        <Router />
      )}
      <Toaster />
    </>
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
