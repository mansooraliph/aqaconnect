import { useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Checkbox } from '../../components/ui/Checkbox';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/toast';
import { MOBILE_API_CATALOG, type AppTab } from './apiCatalog';

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

const TAB_LABELS: Record<AppTab, string> = {
  dashboard: 'Dashboard',
  schedules: 'Schedules',
  lessons: 'Lessons',
  halqa: 'Halqa',
  attendance: 'Attendance',
  profile: 'Profile',
  other: 'Other',
};

const TAB_ORDER: AppTab[] = ['dashboard', 'schedules', 'lessons', 'halqa', 'attendance', 'profile', 'other'];

/** apiCatalog module keys use dashes (e.g. "student-leaves"); permission keys use underscores. */
function derivePermissionKey(catalogKey: string): string {
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

  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');

  const modules = useMemo(
    () =>
      MOBILE_API_CATALOG.filter((m) => m.key !== 'auth' && m.key !== 'profile').map((m) => ({
        key: m.key,
        label: m.label,
        tab: m.tab ?? ('other' as AppTab),
        permissionKey: m.permissionKey ?? derivePermissionKey(m.key),
      })),
    [],
  );

  const modulesByTab = useMemo(() => {
    const grouped = new Map<AppTab, typeof modules>();
    for (const tab of TAB_ORDER) grouped.set(tab, []);
    for (const m of modules) grouped.get(m.tab)!.push(m);
    return grouped;
  }, [modules]);

  const visibleTabs = TAB_ORDER.filter((tab) => (modulesByTab.get(tab)?.length ?? 0) > 0);

  const editingRole = data?.roles.find((r) => r.id === editingRoleId) ?? null;

  const openEditor = (role: MobileRole) => {
    setEditingRoleId(role.id);
    setDraft(new Set(role.grantedKeys));
    setActiveTab(visibleTabs[0] ?? 'dashboard');
  };

  const closeEditor = () => {
    setEditingRoleId(null);
    setDraft(new Set());
  };

  const toggle = (permissionKey: string) => {
    if (!canManage) return;
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(permissionKey)) next.delete(permissionKey);
      else next.add(permissionKey);
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async ({ roleId, permissionKeys }: { roleId: string; permissionKeys: string[] }) => {
      const res = await api.put<MobilePermissionsResponse>(`/roles/${roleId}/mobile-permissions`, { permissionKeys });
      return res.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['mobile-permissions'], updated);
      toast.success('Mobile API permissions updated');
      closeEditor();
    },
    onError: () => toast.error('Failed to update permissions'),
  });

  const handleSave = () => {
    if (!editingRole) return;
    saveMutation.mutate({ roleId: editingRole.id, permissionKeys: [...draft] });
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
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-table-alt">
              <th className="px-4 py-3 text-left font-semibold text-text-primary">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-text-primary">Permissions granted</th>
              {canManage && <th className="px-4 py-3 text-right font-semibold text-text-primary">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (data?.roles.length ?? 0) === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-text-muted">
                  No roles found
                </td>
              </tr>
            )}
            {data?.roles.map((role) => {
              const grantedCount = modules.filter((m) => role.grantedKeys.includes(m.permissionKey)).length;
              return (
                <tr key={role.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary">{role.name}</span>
                      <Badge tone={role.scope === 'GLOBAL' ? 'purple' : 'blue'}>{role.scope}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {grantedCount} of {modules.length}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => openEditor(role)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editingRole}
        title={editingRole ? `Edit permissions — ${editingRole.name}` : ''}
        onClose={closeEditor}
        position="right"
        width="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={closeEditor} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saveMutation.isPending}>
              Save
            </Button>
          </>
        }
      >
        {editingRole && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-1 border-b border-border pb-3">
              {visibleTabs.map((tab) => {
                const tabModules = modulesByTab.get(tab) ?? [];
                const grantedInTab = tabModules.filter((m) => draft.has(m.permissionKey)).length;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'rounded-card px-3 py-1.5 text-sm font-medium transition-colors',
                      activeTab === tab
                        ? 'bg-blue text-white'
                        : 'bg-table-alt text-text-muted hover:text-text-primary',
                    )}
                  >
                    {TAB_LABELS[tab]}
                    <span className="ml-1.5 text-xs opacity-80">
                      ({grantedInTab}/{tabModules.length})
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-1">
              {(modulesByTab.get(activeTab) ?? []).map((m) => (
                <label
                  key={m.key}
                  className="flex items-center justify-between gap-3 rounded-card px-2 py-2 hover:bg-table-alt"
                >
                  <span className="text-sm text-text-primary">{m.label}</span>
                  <Checkbox
                    checked={draft.has(m.permissionKey)}
                    onChange={() => toggle(m.permissionKey)}
                    disabled={!canManage}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
