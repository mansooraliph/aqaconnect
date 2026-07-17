import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { Checkbox } from '../components/ui/Checkbox';
import { Modal } from '../components/ui/Modal';

interface Permission {
  id: string;
  key: string;
  module: string;
  description: string | null;
}

interface RolePermissionEntry {
  id: string;
  permissionId: string;
  permission: Permission;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  scope: 'GLOBAL' | 'BRANCH';
  isSystem: boolean;
  rolePermissions: RolePermissionEntry[];
}

function labelFor(text: string): string {
  return text
    .split(/[._]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function RolesPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = hasPermission('system.rbac.view');

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<Role[]>('/roles')).data,
    enabled: canView,
  });

  const permissionsQuery = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => (await api.get<Permission[]>('/permissions')).data,
    enabled: canView,
  });

  const [viewingRole, setViewingRole] = useState<Role | null>(null);

  const permissionsByModule = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const perm of permissionsQuery.data ?? []) {
      const list = groups.get(perm.module) ?? [];
      list.push(perm);
      groups.set(perm.module, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissionsQuery.data]);

  const grantedKeys = useMemo(
    () => new Set((viewingRole?.rolePermissions ?? []).map((rp) => rp.permission.key)),
    [viewingRole],
  );

  const columns: ColumnDef<Role, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Description',
      accessorKey: 'description',
      cell: ({ row }) => row.original.description ?? '—',
    },
    {
      header: 'Scope',
      id: 'scope',
      cell: ({ row }) => <Badge tone={row.original.scope === 'GLOBAL' ? 'purple' : 'blue'}>{row.original.scope}</Badge>,
    },
    {
      header: 'Type',
      id: 'isSystem',
      cell: ({ row }) => (
        <Badge tone={row.original.isSystem ? 'gray' : 'green'}>{row.original.isSystem ? 'System' : 'Custom'}</Badge>
      ),
    },
    {
      header: 'Permissions',
      id: 'permCount',
      cell: ({ row }) => row.original.rolePermissions.length,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => setViewingRole(row.original)}>
          <Eye className="h-4 w-4" />
          View
        </Button>
      ),
    },
  ];

  if (!canView) {
    return <p className="text-sm text-text-muted">You do not have permission to view this page.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Roles & Permissions" variant="plain" />
      <p className="-mt-2 text-sm text-text-muted">
        Roles and their permission grants. This portal exposes role/permission viewing only — role
        and permission assignment must be managed via the backend/seed data.
      </p>
      <DataTable<Role>
        columns={columns}
        data={rolesQuery.data ?? []}
        isLoading={rolesQuery.isLoading || permissionsQuery.isLoading}
      />

      <Modal
        open={Boolean(viewingRole)}
        title={viewingRole ? `${viewingRole.name} — Permissions` : ''}
        onClose={() => setViewingRole(null)}
        width="max-w-2xl"
        footer={
          <Button variant="outline" onClick={() => setViewingRole(null)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          {permissionsByModule.map(([module, perms]) => (
            <div key={module}>
              <p className="mb-2 text-sm font-semibold text-text-primary">{labelFor(module)}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {perms.map((perm) => (
                  <label key={perm.id} className="flex items-start gap-2">
                    <Checkbox checked={grantedKeys.has(perm.key)} onChange={() => {}} disabled />
                    <span className="text-sm text-text-primary">
                      {perm.description ?? labelFor(perm.key.split('.').pop() ?? perm.key)}
                      <span className="block text-xs text-text-faint">{perm.key}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
