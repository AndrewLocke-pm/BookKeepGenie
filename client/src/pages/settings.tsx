import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Building2, Shield, Tag, Users, ChevronRight, LogOut, UserCircle } from 'lucide-react';
import { SignOutButton } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useOrganisation } from '@/context/organisation-context';
import type { OrganisationMeta } from '@/context/organisation-context';
import type { TaxProfile } from '@shared/schema';
import { useOrgFetch } from '@/context/organisation-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function Settings() {
  const { user } = useAuth();
  const { selectedOrg } = useOrganisation();
  const { orgFetch, selectedOrgId } = useOrgFetch();

  const { data: taxProfile, isLoading: profileLoading } = useQuery<TaxProfile | null>({
    queryKey: ['/api/tax/profile', selectedOrgId],
    queryFn: orgFetch('/api/tax/profile'),
  });

  const initials =
    ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')).toUpperCase() ||
    user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
    'U';

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your organisation and account settings.</p>
      </div>

      {/* Organisation Profile */}
      <SettingsSection
        icon={<Building2 className="w-4 h-4" />}
        title="Organisation Profile"
        description="Read-only view of your organisation details."
      >
        {selectedOrg ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow label="Name" value={selectedOrg.name} />
            {selectedOrg.vatNumber && (
              <InfoRow label="VAT Number" value={selectedOrg.vatNumber} />
            )}
            <InfoRow label="Country" value={selectedOrg.country} />
            <InfoRow label="Your Role" value={selectedOrg.userRole} capitalize />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No organisation selected.</p>
        )}
        <div className="mt-4">
          <Link href="/organisations">
            <Button variant="outline" size="sm" data-testid="button-view-organisations">
              View Organisations
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </SettingsSection>

      {/* Tax Profile */}
      <SettingsSection
        icon={<Shield className="w-4 h-4" />}
        title="Tax Profile"
        description="VAT registration, legal form, and tax rate configuration."
      >
        {profileLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : taxProfile ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {taxProfile.vatNumber && (
              <InfoRow label="VAT Number" value={taxProfile.vatNumber} />
            )}
            {taxProfile.legalForm && (
              <InfoRow label="Legal Form" value={taxProfile.legalForm} />
            )}
            <InfoRow label="VAT Rate" value={`${taxProfile.vatRate ?? 15}%`} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No tax profile configured yet.</p>
        )}
        <div className="mt-4">
          <Link href="/tax-settings">
            <Button variant="outline" size="sm" data-testid="button-edit-tax-profile">
              Edit Tax Profile
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </SettingsSection>

      {/* Categories */}
      <SettingsSection
        icon={<Tag className="w-4 h-4" />}
        title="Categories"
        description="Transaction categories used to classify bookkeeping entries."
      >
        <p className="text-sm text-muted-foreground">
          Categories are managed centrally. Category editing will be available in a future update.
        </p>
        <div className="mt-4">
          <Link href="/categories">
            <Button variant="outline" size="sm" data-testid="button-view-categories">
              View Categories
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </SettingsSection>

      {/* Members */}
      <SettingsSection
        icon={<Users className="w-4 h-4" />}
        title="Members"
        description="People who have access to this organisation."
      >
        {selectedOrg ? (
          <p className="text-sm text-muted-foreground">
            {selectedOrg.memberCount} {selectedOrg.memberCount === 1 ? 'member' : 'members'} in{' '}
            {selectedOrg.name}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No organisation selected.</p>
        )}
        <div className="mt-4">
          <Link href="/members">
            <Button variant="outline" size="sm" data-testid="button-view-members">
              View Members
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </SettingsSection>

      {/* Account */}
      <SettingsSection
        icon={<UserCircle className="w-4 h-4" />}
        title="Account"
        description="Your personal account and sign-in settings."
      >
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            {user?.imageUrl && <AvatarImage src={user.imageUrl} alt={user.fullName || 'User'} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{user?.fullName || 'User'}</p>
            <p className="text-xs text-muted-foreground">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <SignOutButton>
            <Button variant="outline" size="sm" data-testid="button-sign-out-settings">
              <LogOut className="w-4 h-4 mr-1.5" />
              Sign Out
            </Button>
          </SignOutButton>
        </div>
      </SettingsSection>
    </div>
  );
}

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function InfoRow({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-sm font-medium ${capitalize ? 'capitalize' : ''}`}>{value}</p>
    </div>
  );
}
