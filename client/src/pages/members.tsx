import { useQuery } from '@tanstack/react-query';
import { Users, CheckCircle, Clock } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { useOrganisation } from '@/context/organisation-context';

interface MemberWithUser {
  userId: string;
  organisationId: number;
  role: string;
  invitedAt: string;
  acceptedAt: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export default function Members() {
  const { selectedOrgId, selectedOrg } = useOrganisation();

  const { data: members = [], isLoading } = useQuery<MemberWithUser[]>({
    queryKey: ['/api/organisations', selectedOrgId, 'members'],
    queryFn: () =>
      fetch(`/api/organisations/${selectedOrgId}/members`, { credentials: 'include' })
        .then(r => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json();
        }),
    enabled: selectedOrgId != null,
  });

  if (!selectedOrgId) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <Users className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">No organisation selected.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-muted-foreground mt-1">
          {selectedOrg
            ? `Members of ${selectedOrg.name}.`
            : 'Organisation members.'}{' '}
          Read-only — member management coming in a future release.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Members
          </CardTitle>
          <CardDescription>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-8 text-center">
              No members found for this organisation.
            </p>
          ) : (
            <div className="divide-y">
              {members.map(member => {
                const displayName =
                  [member.firstName, member.lastName].filter(Boolean).join(' ') ||
                  member.email ||
                  'Unknown User';
                const initials =
                  ((member.firstName?.[0] ?? '') + (member.lastName?.[0] ?? '')).toUpperCase() ||
                  (member.email?.[0]?.toUpperCase() ?? 'U');
                const isAccepted = !!member.acceptedAt;

                return (
                  <div
                    key={member.userId}
                    className="flex items-center gap-4 px-6 py-4"
                    data-testid={`member-row-${member.userId}`}
                  >
                    <Avatar className="w-9 h-9 shrink-0">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      {member.email && (
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="secondary" className="capitalize text-xs">
                        {member.role}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {isAccepted ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            <span>Accepted {formatDate(member.acceptedAt!)}</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>Invited {formatDate(member.invitedAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
