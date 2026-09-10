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
import { MOBILE_API_CATALOG, type AppTab, type RoleTier } from './apiCatalog';

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
  hifdh: 'Hifdh',
  attendance: 'Attendance',
  profile: 'Profile',
  other: 'Other',
};

/** 'other' is intentionally excluded — those permissions aren't tied to a specific app tab and aren't editable here. */
const TAB_ORDER: AppTab[] = ['dashboard', 'schedules', 'lessons', 'halqa', 'hifdh', 'attendance', 'profile'];

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

  const ADMIN_ROLE_NAMES = ['Super Admin', 'Branch Admin', 'Management'];

  /** Anything not Admin or Student defaults to the 'teacher' tier (Teacher, Accountant, etc.). */
  const roleTier = (name: string): RoleTier => {
    if (ADMIN_ROLE_NAMES.includes(name)) return 'admin';
    if (name === 'Student') return 'student';
    return 'teacher';
  };

  const sortedRoles = useMemo(() => {
    const roles = data?.roles ?? [];
    const admin = ADMIN_ROLE_NAMES.map((name) => roles.find((r) => r.name === name)).filter(
      (r): r is MobileRole => !!r,
    );
    const staff = roles.filter((r) => !ADMIN_ROLE_NAMES.includes(r.name));
    return { admin, staff };
  }, [data?.roles]);

  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');

  const modules = useMemo(
    () =>
      MOBILE_API_CATALOG.filter(
        (m) => !['auth', 'profile', 'surah-schedules'].includes(m.key) && m.tab && m.tab !== 'other',
      )
        .map((m) => ({
          key: m.key,
          label: m.label,
          tab: m.tab as AppTab,
          section: m.section,
          order: m.order ?? 0,
          alwaysOff: m.alwaysOff ?? false,
          tiers: m.tiers,
          permissionKey: m.permissionKey ?? derivePermissionKey(m.key),
        }))
        .sort((a, b) => a.order - b.order),
    [],
  );

  /** Modules with no `tiers` restriction are shared across all role tiers. */
  const modulesForRoleTier = (tier: RoleTier) => modules.filter((m) => !m.tiers || m.tiers.includes(tier));

  const editingRole = data?.roles.find((r) => r.id === editingRoleId) ?? null;
  const editingTier: RoleTier = editingRole ? roleTier(editingRole.name) : 'teacher';

  const roleModules = useMemo(() => modulesForRoleTier(editingTier), [modules, editingTier]);

  const modulesByTab = useMemo(() => {
    const grouped = new Map<AppTab, typeof modules>();
    for (const tab of TAB_ORDER) grouped.set(tab, []);
    for (const m of roleModules) grouped.get(m.tab)!.push(m);
    return grouped;
  }, [roleModules]);

  const visibleTabs = TAB_ORDER.filter((tab) => (modulesByTab.get(tab)?.length ?? 0) > 0);

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
            {([
              ['Admin Roles', sortedRoles.admin],
              ['Other Staff Roles', sortedRoles.staff],
            ] as const).flatMap(([heading, roles]) => {
              if (roles.length === 0) return [];
              return [
                <tr key={`heading-${heading}`}>
                  <td colSpan={canManage ? 3 : 2} className="bg-table-alt px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-faint">
                    {heading}
                  </td>
                </tr>,
                ...roles.map((role) => {
                  const roleTierModules = modulesForRoleTier(roleTier(role.name)).filter((m) => !m.alwaysOff);
                  const grantedCount = roleTierModules.filter((m) => role.grantedKeys.includes(m.permissionKey)).length;
                  return (
                    <tr key={role.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary">{role.name}</span>
                          <Badge tone={role.scope === 'GLOBAL' ? 'purple' : 'blue'}>{role.scope}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {grantedCount} of {roleTierModules.length}
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
                }),
              ];
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
                const tabModules = (modulesByTab.get(tab) ?? []).filter((m) => !m.alwaysOff);
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
              {(() => {
                const items = modulesByTab.get(activeTab) ?? [];
                let lastSection: string | undefined;
                return items.map((m) => {
                  const showHeading = m.section && m.section !== lastSection;
                  lastSection = m.section;
                  return (
                    <div key={m.key}>
                      {showHeading && (
                        <p className="mt-3 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-text-faint first:mt-0">
                          {m.section}
                        </p>
                      )}
                      <label className="flex items-center justify-between gap-3 rounded-card px-2 py-2 hover:bg-table-alt">
                        <span className="text-sm text-text-primary">
                          {m.label}
                          {m.alwaysOff && <span className="ml-1.5 text-xs text-text-faint">(not available yet)</span>}
                        </span>
                        <Checkbox
                          checked={!m.alwaysOff && draft.has(m.permissionKey)}
                          onChange={() => toggle(m.permissionKey)}
                          disabled={!canManage || m.alwaysOff}
                        />
                      </label>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
