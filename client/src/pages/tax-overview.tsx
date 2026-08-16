import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { FileSpreadsheet, Calculator, Settings, ChevronRight, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import { useOrgFetch } from '@/context/organisation-context';
import type { VatReturn, Irp6Estimate, TaxProfile } from '@shared/schema';

export default function TaxOverview() {
  const { orgFetch, selectedOrgId } = useOrgFetch();

  const { data: taxProfile, isLoading: profileLoading } = useQuery<TaxProfile | null>({
    queryKey: ['/api/tax/profile', selectedOrgId],
    queryFn: orgFetch('/api/tax/profile'),
  });

  const { data: vatReturns = [], isLoading: vatLoading } = useQuery<VatReturn[]>({
    queryKey: ['/api/vat/returns', selectedOrgId],
    queryFn: orgFetch('/api/vat/returns'),
  });

  const { data: irp6Estimates = [], isLoading: irp6Loading } = useQuery<Irp6Estimate[]>({
    queryKey: ['/api/irp6/estimates', selectedOrgId],
    queryFn: orgFetch('/api/irp6/estimates'),
  });

  const isLoading = profileLoading || vatLoading || irp6Loading;

  const latestVat = vatReturns[0];
  const latestIrp6 = irp6Estimates[0];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tax Overview</h1>
          <p className="text-muted-foreground mt-1">
            VAT201 and IRP6 provisional tax summary for your organisation.
          </p>
        </div>
        <Link href="/tax-settings">
          <Button variant="outline" size="sm" data-testid="button-tax-profiles">
            <Settings className="w-4 h-4 mr-1.5" />
            Tax Profiles
          </Button>
        </Link>
      </div>

      {/* Tax profile summary */}
      {taxProfile && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Registered Entity
                </p>
                <p className="font-medium">{taxProfile.legalForm || 'Not specified'}</p>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  VAT Number
                </p>
                <p className="font-medium">{taxProfile.vatNumber || 'Not registered'}</p>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  VAT Rate
                </p>
                <p className="font-medium">{taxProfile.vatRate ?? 15}%</p>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Tax Period
                </p>
                <p className="font-medium">
                  {taxProfile.taxYearStart
                    ? `${taxProfile.taxYearStart} – ${taxProfile.taxYearEnd ?? '—'}`
                    : 'Not configured'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VAT201 + IRP6 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* VAT201 card */}
        <Card data-testid="card-vat201">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="w-4 h-4" />
              VAT201 Returns
            </CardTitle>
            <CardDescription>
              {vatReturns.length} {vatReturns.length === 1 ? 'return' : 'returns'} on record
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {latestVat ? (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Latest period</p>
                  <p className="text-sm font-medium">
                    {formatDate(latestVat.startDate)} – {formatDate(latestVat.endDate)}
                  </p>
                </div>
                <Badge variant={latestVat.status === 'finalised' ? 'default' : 'secondary'}>
                  {latestVat.status === 'finalised' ? (
                    <CheckCircle className="w-3 h-3 mr-1" />
                  ) : (
                    <Clock className="w-3 h-3 mr-1" />
                  )}
                  {latestVat.status}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No returns filed yet.</p>
            )}
            <Link href="/vat201">
              <Button variant="outline" size="sm" className="w-full" data-testid="button-go-vat201">
                Open VAT201
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* IRP6 card */}
        <Card data-testid="card-irp6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="w-4 h-4" />
              IRP6 Provisional Tax
            </CardTitle>
            <CardDescription>
              {irp6Estimates.length} {irp6Estimates.length === 1 ? 'estimate' : 'estimates'} saved
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {latestIrp6 ? (
              <div>
                <p className="text-xs text-muted-foreground">Latest estimate</p>
                <p className="text-sm font-medium">
                  {latestIrp6.yearOfAssessment} – {latestIrp6.half === 1 ? '1st half' : '2nd half'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No estimates saved yet.</p>
            )}
            <Link href="/irp6">
              <Button variant="outline" size="sm" className="w-full" data-testid="button-go-irp6">
                Open IRP6
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
