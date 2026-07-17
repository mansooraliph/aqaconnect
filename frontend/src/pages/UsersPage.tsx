import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, ShieldPlus } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useBranches } from '../hooks/useBranches';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Field, Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { toast } from '../components/ui/toast';

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  branchId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

interface RoleGrant {
  id: string;
  roleId: string;
  branchId: string | null;
  role: { id: string; name: string; scope: 'GLOBAL' | 'BRANCH' };
}

interface UserDetail extends UserRow {
  userRoles: RoleGrant[];
}

interface Role {
  id: string;
  name: string;
  scope: 'GLOBAL' | 'BRANCH';
}

const emptyCreateForm = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  branchId: '',
};

export function UsersPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = hasPermission('system.users.view');
  const canManage = hasPermission('system.users.manage');
  const canViewRoles = hasPermission('system.rbac.view');
  const queryClient = useQueryClient();

  const { data: branches } = useBranches();

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<UserRow[]>('/users')).data,
    enabled: canView,
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<Role[]>('/roles')).data,
    enabled: canViewRoles && canManage,
  });

  const createUser = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post('/users', payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const assignRole = useMutation({
    mutationFn: async ({ userId, roleId, branchId }: { userId: string; roleId: string; branchId?: string }) =>
      (await api.post(`/users/${userId}/roles`, { roleId, branchId: branchId || undefined })).data,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-detail', variables.userId] });
    },
  });

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyCreateForm);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [rolesModalUserId, setRolesModalUserId] = useState<string | null>(null);
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignBranchId, setAssignBranchId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const userDetailQuery = useQuery({
    queryKey: ['user-detail', rolesModalUserId],
    queryFn: async () => (await api.get<UserDetail>(`/users/${rolesModalUserId}`)).data,
    enabled: Boolean(rolesModalUserId),
  });

  const branchName = (branchId: string | null) =>
    branches?.find((b) => b.id === branchId)?.name ?? (branchId ? branchId : 'No home branch');

  const openAdd = () => {
    setAddForm(emptyCreateForm);
    setAddErrors({});
    setAddOpen(true);
  };

  const submitAdd = async () => {
    const errors: Record<string, string> = {};
    if (!addForm.email) errors.email = 'Email is required';
    if (!addForm.password || addForm.password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (!addForm.firstName) errors.firstName = 'First name is required';
    if (!addForm.lastName) errors.lastName = 'Last name is required';
    setAddErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setAddSubmitting(true);
    try {
      await createUser.mutateAsync({
        email: addForm.email,
        password: addForm.password,
        firstName: addForm.firstName,
        lastName: addForm.lastName,
        phone: addForm.phone || undefined,
        branchId: addForm.branchId || undefined,
      });
      toast.success('User created');
      setAddOpen(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setAddSubmitting(false);
    }
  };

  const openRolesModal = (userId: string) => {
    setRolesModalUserId(userId);
    setAssignRoleId('');
    setAssignBranchId('');
  };

  const submitAssignRole = async () => {
    if (!rolesModalUserId || !assignRoleId) return;
    setAssignSubmitting(true);
    try {
      await assignRole.mutateAsync({ userId: rolesModalUserId, roleId: assignRoleId, branchId: assignBranchId });
      toast.success('Role assigned');
      setAssignRoleId('');
      setAssignBranchId('');
    } catch {
      toast.error('Failed to assign role');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const columns: ColumnDef<UserRow, unknown>[] = [
    {
      header: 'Name',
      id: 'name',
      cell: ({ row }) => (
        <span className="font-medium text-text-primary">
          {row.original.firstName} {row.original.lastName}
        </span>
      ),
    },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Phone', accessorKey: 'phone', cell: ({ row }) => row.original.phone ?? '—' },
    { header: 'Branch', id: 'branch', cell: ({ row }) => branchName(row.original.branchId) },
    {
      header: 'Status',
      id: 'isActive',
      cell: ({ row }) => <StatusBadge status={row.original.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      header: 'Last Login',
      accessorKey: 'lastLoginAt',
      cell: ({ row }) =>
        row.original.lastLoginAt ? new Date(row.original.lastLoginAt).toLocaleString() : 'Never',
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: '',
            cell: ({ row }: { row: { original: UserRow } }) => (
              <Button size="sm" variant="ghost" onClick={() => openRolesModal(row.original.id)}>
                <ShieldPlus className="h-4 w-4" />
                Roles
              </Button>
            ),
          } satisfies ColumnDef<UserRow, unknown>,
        ]
      : []),
  ];

  if (!canView) {
    return <p className="text-sm text-text-muted">You do not have permission to view this page.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Users"
        variant="plain"
        actions={
          canManage && (
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          )
        }
      />
      <DataTable<UserRow> columns={columns} data={usersQuery.data ?? []} isLoading={usersQuery.isLoading} />

      <Modal
        open={addOpen}
        title="Add User"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addSubmitting}>
              Cancel
            </Button>
            <Button onClick={submitAdd} loading={addSubmitting}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Email" required error={addErrors.email}>
            <Input
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
          <Field label="Password" required error={addErrors.password} hint="At least 8 characters">
            <Input
              type="password"
              value={addForm.password}
              onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
            />
          </Field>
          <Field label="First name" required error={addErrors.firstName}>
            <Input
              value={addForm.firstName}
              onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </Field>
          <Field label="Last name" required error={addErrors.lastName}>
            <Input
              value={addForm.lastName}
              onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </Field>
          <Field label="Phone">
            <Input value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Branch" hint="Leave unset for a global (non-branch) user">
            <Select
              value={addForm.branchId}
              onChange={(e) => setAddForm((f) => ({ ...f, branchId: e.target.value }))}
              placeholder="No home branch (global)"
              options={(branches ?? []).map((b) => ({ label: b.name, value: b.id }))}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(rolesModalUserId)}
        title="Manage Roles"
        onClose={() => setRolesModalUserId(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setRolesModalUserId(null)}>
              Close
            </Button>
            <Button onClick={submitAssignRole} loading={assignSubmitting} disabled={!assignRoleId}>
              Assign Role
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">Current roles</p>
            {userDetailQuery.isLoading ? (
              <p className="text-sm text-text-muted">Loading…</p>
            ) : userDetailQuery.data && userDetailQuery.data.userRoles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {userDetailQuery.data.userRoles.map((ur) => (
                  <Badge key={ur.id} tone="blue">
                    {ur.role.name}
                    {ur.branchId ? ` (${branchName(ur.branchId)})` : ''}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No roles assigned yet.</p>
            )}
          </div>

          {canViewRoles ? (
            <div className="flex flex-col gap-4 border-t border-border pt-4">
              <Field label="Role" required>
                <Select
                  value={assignRoleId}
                  onChange={(e) => setAssignRoleId(e.target.value)}
                  placeholder="Select a role"
                  options={(rolesQuery.data ?? []).map((r) => ({ label: `${r.name} (${r.scope})`, value: r.id }))}
                />
              </Field>
              <Field label="Branch override" hint="Optional — only needed to scope a BRANCH-level role to a specific branch">
                <Select
                  value={assignBranchId}
                  onChange={(e) => setAssignBranchId(e.target.value)}
                  placeholder="Use user's home branch"
                  options={(branches ?? []).map((b) => ({ label: b.name, value: b.id }))}
                />
              </Field>
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              You do not have permission to view the roles list.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
