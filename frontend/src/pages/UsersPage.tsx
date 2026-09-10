import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { KeyRound, Pencil, Plus } from 'lucide-react';
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
import { FilterSelect } from '../components/ui/FilterSelect';
import { toast } from '../components/ui/toast';

const USER_TYPES = ['Admin', 'Office Staff', 'Teacher', 'Student'] as const;
type UserType = (typeof USER_TYPES)[number];

function getErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data
    ?.message;
  return serverMessage ?? fallback;
}

interface UserRow {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  branchId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  type: UserType;
  role: string | null;
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
  name: '',
  username: '',
  password: '',
  phone: '',
  email: '',
  branchId: '',
  type: 'Admin' as const,
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

  const createBranchEmployee = useMutation({
    mutationFn: async ({ branchId, payload }: { branchId: string; payload: Record<string, unknown> }) =>
      (await api.post(`/branches/${branchId}/employees`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const assignRole = useMutation({
    mutationFn: async ({ userId, roleId, branchId }: { userId: string; roleId: string; branchId?: string }) =>
      (await api.post(`/users/${userId}/roles`, { roleId, branchId: branchId || undefined })).data,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-detail', variables.userId] });
    },
  });

  const resetPassword = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) =>
      (await api.post(`/users/${userId}/reset-password`, { password })).data,
  });

  const updateUser = useMutation({
    mutationFn: async ({ userId, payload }: { userId: string; payload: Record<string, unknown> }) =>
      (await api.patch(`/users/${userId}`, payload)).data,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-detail', variables.userId] });
    },
  });

  const [filterType, setFilterType] = useState('');
  const filteredUsers = useMemo(() => {
    const users = usersQuery.data ?? [];
    return filterType ? users.filter((u) => u.type === filterType) : users;
  }, [usersQuery.data, filterType]);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyCreateForm);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', branchId: '', isActive: true });
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignBranchId, setAssignBranchId] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [resetPasswordSubmitting, setResetPasswordSubmitting] = useState(false);

  const userDetailQuery = useQuery({
    queryKey: ['user-detail', editUserId],
    queryFn: async () => (await api.get<UserDetail>(`/users/${editUserId}`)).data,
    enabled: Boolean(editUserId),
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
    if (!addForm.name) errors.name = 'Name is required';
    if (!addForm.username) errors.username = 'Username is required';
    if (!addForm.password) errors.password = 'Password is required';
    if (addForm.email && !/^\S+@\S+\.\S+$/.test(addForm.email)) errors.email = 'Must be a valid email';
    setAddErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setAddSubmitting(true);
    try {
      if (addForm.branchId) {
        const employee = await createBranchEmployee.mutateAsync({
          branchId: addForm.branchId,
          payload: {
            name: addForm.name,
            username: addForm.username,
            password: addForm.password,
            phone: addForm.phone || undefined,
            email: addForm.email || undefined,
            employeeType: 'ADMIN',
          },
        });
        const branchAdminRole = rolesQuery.data?.find((r) => r.name === 'Branch Admin');
        if (branchAdminRole) {
          await assignRole.mutateAsync({
            userId: (employee as { userId: string }).userId,
            roleId: branchAdminRole.id,
            branchId: addForm.branchId,
          });
        }
      } else {
        await createUser.mutateAsync({
          name: addForm.name,
          username: addForm.username,
          password: addForm.password,
          phone: addForm.phone || undefined,
          email: addForm.email || undefined,
        });
      }
      toast.success('User created');
      setAddOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Something went wrong'));
    } finally {
      setAddSubmitting(false);
    }
  };

  const openEdit = (userId: string) => {
    setEditUserId(userId);
    setAssignRoleId('');
    setAssignBranchId('');
  };

  // Once the user's detail loads, populate both the profile fields and the
  // (exactly one) role grant, so this reads as editing what's there already.
  useEffect(() => {
    const detail = userDetailQuery.data;
    if (!detail) return;
    setEditForm({
      name: [detail.firstName, detail.lastName].filter(Boolean).join(' '),
      email: detail.email ?? '',
      phone: detail.phone ?? '',
      branchId: detail.branchId ?? '',
      isActive: detail.isActive,
    });
    const currentRole = detail.userRoles[0];
    if (currentRole) {
      setAssignRoleId(currentRole.roleId);
      setAssignBranchId(currentRole.branchId ?? '');
    }
  }, [userDetailQuery.data]);

  const submitEdit = async () => {
    if (!editUserId) return;
    setEditSubmitting(true);
    try {
      await updateUser.mutateAsync({
        userId: editUserId,
        payload: {
          name: editForm.name || undefined,
          email: editForm.email || undefined,
          phone: editForm.phone || undefined,
          branchId: editForm.branchId || null,
          isActive: editForm.isActive,
        },
      });
      if (assignRoleId) {
        await assignRole.mutateAsync({ userId: editUserId, roleId: assignRoleId, branchId: assignBranchId });
      }
      toast.success('User updated');
      setEditUserId(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update user'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const openResetPassword = (userId: string) => {
    setResetPasswordUserId(userId);
    setResetPasswordValue('');
    setResetPasswordError('');
  };

  const submitResetPassword = async () => {
    if (!resetPasswordUserId) return;
    if (resetPasswordValue.length < 6) {
      setResetPasswordError('Password must be at least 6 characters');
      return;
    }
    setResetPasswordSubmitting(true);
    try {
      await resetPassword.mutateAsync({ userId: resetPasswordUserId, password: resetPasswordValue });
      toast.success('Password reset');
      setResetPasswordUserId(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to reset password'));
    } finally {
      setResetPasswordSubmitting(false);
    }
  };

  const columns: ColumnDef<UserRow, unknown>[] = [
    {
      header: 'Name',
      id: 'name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-text-primary">
            {row.original.firstName} {row.original.lastName}
          </div>
          {row.original.phone && <div className="text-xs text-text-muted">{row.original.phone}</div>}
        </div>
      ),
    },
    { header: 'Username', accessorKey: 'username' },
    { header: 'Type', accessorKey: 'type' },
    {
      header: 'Role',
      id: 'role',
      cell: ({ row }) =>
        row.original.role ? <Badge tone="blue">{row.original.role}</Badge> : <span className="text-text-faint">—</span>,
    },
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
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(row.original.id)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openResetPassword(row.original.id)}
                  title="Reset Password"
                  aria-label="Reset Password"
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
              </div>
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
      <FilterSelect
        width="w-64"
        label="Filter by Type"
        placeholder="All Types"
        value={filterType}
        onChange={setFilterType}
        options={USER_TYPES.map((t) => ({ label: t, value: t }))}
      />
      <DataTable<UserRow> columns={columns} data={filteredUsers} isLoading={usersQuery.isLoading} />

      <Modal
        open={addOpen}
        title="Add User"
        onClose={() => setAddOpen(false)}
        position="right"
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
          <Field label="Name" required error={addErrors.name}>
            <Input
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Username" required error={addErrors.username} hint="Used to log in — doesn't need to be an email.">
            <Input
              value={addForm.username}
              onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
            />
          </Field>
          <Field label="Password" required error={addErrors.password}>
            <Input
              type="password"
              value={addForm.password}
              onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
            />
          </Field>
          <Field label="Mobile">
            <Input value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Email" error={addErrors.email}>
            <Input
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
          <Field label="Branch" hint="Leave unset for a global (non-branch) user">
            <Select
              value={addForm.branchId}
              onChange={(e) => setAddForm((f) => ({ ...f, branchId: e.target.value }))}
              placeholder="No home branch (global)"
              options={(branches ?? []).map((b) => ({ label: b.name, value: b.id }))}
            />
          </Field>
          {addForm.branchId && (
            <Field
              label="User Type"
              required
              hint="Creates an Employee record and grants the Branch Admin role for this branch."
            >
              <Select value={addForm.type} onChange={() => {}} options={[{ label: 'Admin', value: 'Admin' }]} />
            </Field>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(editUserId)}
        title="Edit User"
        onClose={() => setEditUserId(null)}
        position="right"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditUserId(null)} disabled={editSubmitting}>
              Cancel
            </Button>
            <Button onClick={submitEdit} loading={editSubmitting}>
              Save
            </Button>
          </>
        }
      >
        {userDetailQuery.isLoading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Name">
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
            <Field label="Mobile">
              <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
            </Field>
            <Field label="Branch" hint="Leave unset for a global (non-branch) user">
              <Select
                value={editForm.branchId}
                onChange={(e) => setEditForm((f) => ({ ...f, branchId: e.target.value }))}
                placeholder="No home branch (global)"
                options={(branches ?? []).map((b) => ({ label: b.name, value: b.id }))}
              />
            </Field>
            <Field label="Status">
              <Select
                value={editForm.isActive ? 'active' : 'inactive'}
                onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.value === 'active' }))}
                options={[
                  { label: 'Active', value: 'active' },
                  { label: 'Inactive', value: 'inactive' },
                ]}
              />
            </Field>

            {canViewRoles ? (
              <div className="flex flex-col gap-4 border-t border-border pt-4">
                <p className="text-sm font-medium text-text-primary">Role</p>
                <Field label="Role">
                  <Select
                    value={assignRoleId}
                    onChange={(e) => setAssignRoleId(e.target.value)}
                    placeholder="No role assigned"
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
              <p className="border-t border-border pt-4 text-sm text-text-muted">
                You do not have permission to view the roles list.
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(resetPasswordUserId)}
        title="Reset Password"
        onClose={() => setResetPasswordUserId(null)}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setResetPasswordUserId(null)}
              disabled={resetPasswordSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={submitResetPassword} loading={resetPasswordSubmitting}>
              Reset Password
            </Button>
          </>
        }
      >
        <Field label="New Password" required error={resetPasswordError}>
          <Input
            type="password"
            value={resetPasswordValue}
            onChange={(e) => setResetPasswordValue(e.target.value)}
          />
        </Field>
      </Modal>
    </div>
  );
}
