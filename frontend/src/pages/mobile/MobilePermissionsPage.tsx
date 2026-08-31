import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Checkbox } from '../../components/ui/Checkbox';
import { Button } from '../../components/ui/Button';
import { toast } from '../../components/ui/toast';
import { MOBILE_API_CATALOG } from './apiCatalog';

interface MobilePermission {
  id: string;
  key: string;
  module: string;
  description: string | null;
}

interface MobileRole {
  id: string;
  name: string;
  scope: 'GLOBAL' | 'BRANCH';
  grantedKeys: string[];
}

interface MobilePermissionsResponse {
  permissions: MobilePermission[];
  roles: MobileRole[];
}

/** apiCatalog module keys use dashes (e.g. "student-leaves"); permission keys use underscores. */
function permissionKeyFor(catalogKey: string): string {
  return `mobile_api.${catalogKey.replace(/-/g, '_')}.access`;
}

export function MobilePermissionsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = hasPermission('system.mobile_api.view');
  const canManage = hasPermission('system.mobile_api.manage');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['mobile-permissions'],
    queryFn: async () => (await api.get<MobilePermissionsResponse>('/mobile-permissions')).data,
    enabled: canView,
  });

  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);
  const [draftByRole, setDraftByRole] = useState<Record<string, Set<string>>>({});

  const modules = useMemo(
    () =>
      MOBILE_API_CATALOG.filter((m) => m.key !== 'auth').map((m) => ({
        key: m.key,
        label: m.label,
        permissionKey: permissionKeyFor(m.key),
      })),
    [],
  );

  const grantedFor = (role: MobileRole): Set<string> => draftByRole[role.id] ?? new Set(role.grantedKeys);

  const isDirty = (role: MobileRole): boolean => {
    const draft = draftByRole[role.id];
    if (!draft) return false;
    const original = new Set(role.grantedKeys);
    if (draft.size !== original.size) return true;
    for (const key of draft) if (!original.has(key)) return true;
    return false;
  };

  const toggle = (role: MobileRole, permissionKey: string) => {
    if (!canManage) return;
    const current = new Set(grantedFor(role));
    if (current.has(permissionKey)) current.delete(permissionKey);
    else current.add(permissionKey);
    setDraftByRole((prev) => ({ ...prev, [role.id]: current }));
  };

  const saveMutation = useMutation({
    mutationFn: async ({ roleId, permissionKeys }: { roleId: string; permissionKeys: string[] }) => {
      const res = await api.put<MobilePermissionsResponse>(`/roles/${roleId}/mobile-permissions`, { permissionKeys });
      return res.data;
    },
    onSuccess: (updated, { roleId }) => {
      queryClient.setQueryData(['mobile-permissions'], updated);
      setDraftByRole((prev) => {
        const next = { ...prev };
        delete next[roleId];
        return next;
      });
      toast.success('Mobile API permissions updated');
    },
    onError: () => toast.error('Failed to update permissions'),
    onSettled: () => setPendingRoleId(null),
  });

  const handleSave = (role: MobileRole) => {
    setPendingRoleId(role.id);
    saveMutation.mutate({ roleId: role.id, permissionKeys: [...grantedFor(role)] });
  };

  if (!canView) {
    return <p className="text-sm text-text-muted">You do not have permission to view this page.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Mobile App API Permissions" variant="plain" />
      <p className="-mt-2 text-sm text-text-muted">
        Controls which mobile app modules each role's users may call on the real{' '}
        <code className="rounded bg-table-alt px-1 py-0.5">/api/app/*</code> endpoints.
        {!canManage && ' Read-only for your role.'}
      </p>

      <div className="overflow-x-auto rounded-card border border-border bg-white">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-table-alt">
              <th className="px-4 py-3 text-left font-semibold text-text-primary">Role</th>
              {modules.map((m) => (
                <th key={m.key} className="px-3 py-3 text-center font-semibold text-text-primary">
                  {m.label}
                </th>
              ))}
              {canManage && <th className="px-3 py-3 text-right font-semibold text-text-primary">Save</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={modules.length + 2} className="px-4 py-6 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (data?.roles.length ?? 0) === 0 && (
              <tr>
                <td colSpan={modules.length + 2} className="px-4 py-6 text-center text-text-muted">
                  No roles found
                </td>
              </tr>
            )}
            {data?.roles.map((role) => {
              const granted = grantedFor(role);
              const dirty = isDirty(role);
              return (
                <tr key={role.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary">{role.name}</span>
                      <Badge tone={role.scope === 'GLOBAL' ? 'purple' : 'blue'}>{role.scope}</Badge>
                    </div>
                  </td>
                  {modules.map((m) => (
                    <td key={m.key} className="px-3 py-3 text-center">
                      <Checkbox
                        checked={granted.has(m.permissionKey)}
                        onChange={() => toggle(role, m.permissionKey)}
                        disabled={!canManage}
                      />
                    </td>
                  ))}
                  {canManage && (
                    <td className="px-3 py-3 text-right">
                      <Button
                        size="sm"
                        variant={dirty ? 'primary' : 'outline'}
                        disabled={!dirty || (saveMutation.isPending && pendingRoleId === role.id)}
                        onClick={() => handleSave(role)}
                      >
                        {saveMutation.isPending && pendingRoleId === role.id ? 'Saving…' : 'Save'}
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
