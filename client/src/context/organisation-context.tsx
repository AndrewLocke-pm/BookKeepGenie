import { createContext, useContext, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface OrganisationMeta {
  id: number;
  name: string;
  vatNumber: string | null;
  country: string;
  createdAt: string;
  updatedAt: string;
  userRole: string;
  memberCount: number;
}

interface OrgContextValue {
  organisations: OrganisationMeta[];
  selectedOrg: OrganisationMeta | null;
  selectedOrgId: number | null;
  setSelectedOrgId: (id: number | null) => void;
  isLoading: boolean;
  orgUrl: (base: string) => string;
}

const OrgContext = createContext<OrgContextValue | null>(null);

function getStoredOrgId(): number | null {
  try {
    const n = parseInt(localStorage.getItem('selectedOrgId') ?? '', 10);
    return isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

export function OrganisationProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [rawOrgId, setRaw] = useState<number | null>(getStoredOrgId);

  const { data: organisations = [], isLoading } = useQuery<OrganisationMeta[]>({
    queryKey: ['/api/organisations'],
  });

  const effectiveId =
    rawOrgId != null && organisations.some(o => o.id === rawOrgId)
      ? rawOrgId
      : (organisations[0]?.id ?? null);

  const selectedOrg = organisations.find(o => o.id === effectiveId) ?? null;

  const setSelectedOrgId = useCallback(
    (id: number | null) => {
      setRaw(id);
      if (id != null) localStorage.setItem('selectedOrgId', String(id));
      else localStorage.removeItem('selectedOrgId');
      queryClient.invalidateQueries({
        predicate: q => {
          const key = q.queryKey[0];
          if (typeof key !== 'string') return false;
          return (
            key.startsWith('/api/transactions') ||
            key.startsWith('/api/vat') ||
            key.startsWith('/api/irp6') ||
            key.startsWith('/api/tax')
          );
        },
      });
    },
    [queryClient],
  );

  const orgUrl = useCallback(
    (base: string) => {
      if (effectiveId == null) return base;
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}organisationId=${effectiveId}`;
    },
    [effectiveId],
  );

  return (
    <OrgContext.Provider
      value={{ organisations, selectedOrg, selectedOrgId: effectiveId, setSelectedOrgId, isLoading, orgUrl }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrganisation() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrganisation must be used within OrganisationProvider');
  return ctx;
}

export function useOrgFetch() {
  const { selectedOrgId, orgUrl } = useOrganisation();

  function orgFetch<T>(baseUrl: string): () => Promise<T> {
    const url = orgUrl(baseUrl);
    return () =>
      fetch(url, { credentials: 'include' }).then(r => {
        if (!r.ok) throw new Error(`${r.status}: ${r.statusText}`);
        return r.json() as Promise<T>;
      });
  }

  return { selectedOrgId, orgUrl, orgFetch };
}
