import { useQuery } from '@tanstack/react-query';
import { Building2, Globe, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { OrganisationMeta } from '@/context/organisation-context';

export default function Organisations() {
  const { data: organisations = [], isLoading } = useQuery<OrganisationMeta[]>({
    queryKey: ['/api/organisations'],
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organisations</h1>
        <p className="text-muted-foreground mt-1">
          Organisations you belong to. Read-only — contact your administrator to make changes.
        </p>
      </div>

      {organisations.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground" />
          <div>
            <p className="font-medium">No organisations found</p>
            <p className="text-sm text-muted-foreground mt-1">
              You are not yet a member of any organisation.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {organisations.map(org => (
            <Card key={org.id} data-testid={`org-card-${org.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="w-4 h-4 shrink-0" />
                    {org.name}
                  </CardTitle>
                  <Badge variant="secondary" className="capitalize shrink-0">
                    {org.userRole}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {org.vatNumber && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        VAT Number
                      </dt>
                      <dd className="text-sm font-medium" data-testid={`org-vat-${org.id}`}>
                        {org.vatNumber}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      Country
                    </dt>
                    <dd className="text-sm font-medium" data-testid={`org-country-${org.id}`}>
                      {org.country}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Members
                    </dt>
                    <dd className="text-sm font-medium" data-testid={`org-members-${org.id}`}>
                      {org.memberCount}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
