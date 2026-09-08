import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Copy, Pencil, Plus } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Field, Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { FilterSelect } from '../../components/ui/FilterSelect';
import { Checkbox } from '../../components/ui/Checkbox';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { toast } from '../../components/ui/toast';

interface StudentUser {
  email: string;
  isActive: boolean;
}

interface Student {
  id: string;
  studentCode: string;
  name: string;
  dateOfBirth: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  user: StudentUser | null;
}

interface Halqa {
  id: string;
  name: string;
  students: { student: { id: string } }[];
}

interface FormState {
  studentCode: string;
  name: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
  status: 'ACTIVE' | 'INACTIVE';
  createLogin: boolean;
  username: string;
  password: string;
  email: string;
  // Assigning a Halqa at creation auto-generates the student's initial Hifdh
  // schedule from the HIFDH-stage Target Schedule rows (see HifdhService).
  halqaId: string;
  hifdhStartDate: string;
}

const EMPTY_FORM: FormState = {
  studentCode: '',
  name: '',
  dateOfBirth: '',
  guardianName: '',
  guardianPhone: '',
  status: 'ACTIVE',
  createLogin: false,
  username: '',
  password: '',
  email: '',
  halqaId: '',
  hifdhStartDate: '',
};

export function StudentsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('student_management.students.manage');
  const queryClient = useQueryClient();

  const { list, create, update, basePath, queryKey } = useBranchResource<Student>(
    activeBranchId,
    'students',
  );

  const halqasQuery = useQuery({
    queryKey: ['halqas', activeBranchId],
    queryFn: async () => (await api.get<Halqa[]>(`/branches/${activeBranchId}/halqas`)).data,
    enabled: Boolean(activeBranchId),
  });
  const halqaOptions = (halqasQuery.data ?? []).map((h) => ({ label: h.name, value: h.id }));

  const findStudentHalqaId = (studentId: string) =>
    (halqasQuery.data ?? []).find((h) => h.students.some((s) => s.student.id === studentId))?.id ?? '';

  const studentHalqaMap = new Map<string, { id: string; name: string }>();
  for (const h of halqasQuery.data ?? []) {
    for (const s of h.students) {
      studentHalqaMap.set(s.student.id, { id: h.id, name: h.name });
    }
  }

  const [filterHalqaId, setFilterHalqaId] = useState('');
  const filteredStudents = (list.data ?? []).filter(
    (s) => !filterHalqaId || studentHalqaMap.get(s.id)?.id === filterHalqaId,
  );

  const bulkAction = useMutation({
    mutationFn: async ({
      ids,
      action,
    }: {
      ids: string[];
      action: 'activate' | 'deactivate' | 'delete';
    }) => (await api.post(`${basePath}/bulk-action`, { ids, action })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [originalHalqaId, setOriginalHalqaId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [credentials, setCredentials] = useState<{
    temporaryPassword: string;
    note?: string;
  } | null>(null);

  const setField = <K extends keyof FormState>(name: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [name]: value }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (record: Student) => {
    setEditing(record);
    const currentHalqaId = findStudentHalqaId(record.id);
    setForm({
      studentCode: record.studentCode,
      name: record.name,
      dateOfBirth: record.dateOfBirth ?? '',
      guardianName: record.guardianName ?? '',
      guardianPhone: record.guardianPhone ?? '',
      status: record.status,
      createLogin: false,
      username: '',
      password: '',
      email: '',
      halqaId: currentHalqaId,
      hifdhStartDate: '',
    });
    setOriginalHalqaId(currentHalqaId);
    setErrors({});
    setModalOpen(true);
  };

  const handleCancel = () => {
    setModalOpen(false);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = 'Student name is required';
    if (!editing && form.createLogin && !form.username.trim()) {
      nextErrors.username = 'A username is required to create a login';
    }
    if (!editing && form.createLogin && form.password && form.password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          payload: {
            name: form.name,
            dateOfBirth: form.dateOfBirth || null,
            guardianName: form.guardianName || null,
            guardianPhone: form.guardianPhone || null,
            status: form.status,
          },
        });
        if (form.halqaId !== originalHalqaId) {
          if (originalHalqaId) {
            await api.post(`/branches/${activeBranchId}/halqas/${originalHalqaId}/remove-student`, {
              studentId: editing.id,
            });
          }
          if (form.halqaId) {
            await api.post(`/branches/${activeBranchId}/halqas/${form.halqaId}/assign-student`, {
              studentId: editing.id,
            });
          }
          queryClient.invalidateQueries({ queryKey: ['halqas', activeBranchId] });
        }
        toast.success('Updated');
        setModalOpen(false);
        setForm(EMPTY_FORM);
      } else {
        // Create payload includes account-provisioning fields (createLogin/
        // username/email/halqaId) that aren't part of the Student
        // read-model, so this doesn't fit useBranchResource's
        // Partial<Student> typing.
        const data = await create.mutateAsync({
          studentCode: form.studentCode.trim() || undefined,
          name: form.name,
          dateOfBirth: form.dateOfBirth || undefined,
          guardianName: form.guardianName || undefined,
          guardianPhone: form.guardianPhone || undefined,
          createLogin: form.createLogin || undefined,
          username: form.createLogin ? form.username : undefined,
          password: form.createLogin && form.password ? form.password : undefined,
          email: form.createLogin && form.email ? form.email : undefined,
          halqaId: form.halqaId || undefined,
          hifdhStartDate: form.hifdhStartDate || undefined,
        } as unknown as Partial<Student>);
        toast.success('Created');
        setModalOpen(false);
        setForm(EMPTY_FORM);
        const withPassword = data as unknown as {
          temporaryPassword?: string;
          note?: string;
        };
        if (withPassword.temporaryPassword) {
          setCredentials({
            temporaryPassword: withPassword.temporaryPassword,
            note: withPassword.note,
          });
        }
      }
    } catch (err) {
      const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data
        ?.message;
      toast.error(serverMessage ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const runBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    try {
      await bulkAction.mutateAsync({ ids: selectedIds, action });
      toast.success('Done');
      setSelectedIds([]);
    } catch {
      toast.error('Bulk action failed');
    } finally {
      setDeleteConfirmOpen(false);
    }
  };

  const copyPassword = () => {
    if (!credentials) return;
    navigator.clipboard.writeText(credentials.temporaryPassword);
    toast.success('Password copied to clipboard');
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  };

  const allSelected = filteredStudents.length > 0 && selectedIds.length === filteredStudents.length;

  const columns: ColumnDef<Student, unknown>[] = [
    ...(canManage
      ? ([
          {
            id: 'select',
            header: () => (
              <Checkbox
                checked={allSelected}
                indeterminate={selectedIds.length > 0 && !allSelected}
                onChange={(checked) =>
                  setSelectedIds(checked ? filteredStudents.map((s) => s.id) : [])
                }
                aria-label="Select all"
              />
            ),
            cell: ({ row }) => (
              <Checkbox
                checked={selectedIds.includes(row.original.id)}
                onChange={() => toggleSelected(row.original.id)}
                aria-label="Select row"
              />
            ),
          },
        ] as ColumnDef<Student, unknown>[])
      : []),
    { header: 'Student Name', accessorKey: 'name' },
    { header: 'Student code', accessorKey: 'studentCode' },
    {
      id: 'halqa',
      header: 'Halqa',
      cell: ({ row }) => studentHalqaMap.get(row.original.id)?.name ?? '-',
    },
    { header: 'Guardian name', accessorKey: 'guardianName', cell: ({ row }) => row.original.guardianName ?? '-' },
    { header: 'Guardian phone', accessorKey: 'guardianPhone', cell: ({ row }) => row.original.guardianPhone ?? '-' },
    {
      id: 'login',
      header: 'Login',
      cell: ({ row }) =>
        row.original.user ? <Badge tone="blue">Has login</Badge> : <Badge>No login</Badge>,
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  const allColumns: ColumnDef<Student, unknown>[] = canManage
    ? [
        ...columns,
        {
          id: 'actions',
          header: '',
          cell: ({ row }) => (
            <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
          ),
        },
      ]
    : columns;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Students"
        variant="plain"
        actions={
          <>
            {canManage && selectedIds.length > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => runBulkAction('activate')}
                  loading={bulkAction.isPending}
                >
                  Activate
                </Button>
                <Button
                  variant="outline"
                  onClick={() => runBulkAction('deactivate')}
                  loading={bulkAction.isPending}
                >
                  Deactivate
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setDeleteConfirmOpen(true)}
                  loading={bulkAction.isPending}
                >
                  Delete
                </Button>
              </>
            )}
            {canManage && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            )}
          </>
        }
      />
      <FilterSelect
        width="w-64"
        label="Filter by Halqa"
        placeholder="All Halqas"
        value={filterHalqaId}
        onChange={setFilterHalqaId}
        options={halqaOptions}
      />
      <DataTable<Student> columns={allColumns} data={filteredStudents} isLoading={list.isLoading} />

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Student' : 'Add Student'}
        onClose={handleCancel}
        position="right"
        width="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={handleCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={submitting}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {editing ? (
            <Field label="Student code">
              <Input value={form.studentCode} readOnly disabled />
            </Field>
          ) : (
            <Field label="Student code" hint="Leave blank to auto-generate" error={errors.studentCode}>
              <Input
                value={form.studentCode}
                onChange={(e) => setField('studentCode', e.target.value)}
              />
            </Field>
          )}
          <Field label="Student Name" required error={errors.name}>
            <Input value={form.name} onChange={(e) => setField('name', e.target.value)} />
          </Field>
          <Field label="Date of birth">
            <Input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setField('dateOfBirth', e.target.value)}
            />
          </Field>
          <Field label="Guardian name">
            <Input
              value={form.guardianName}
              onChange={(e) => setField('guardianName', e.target.value)}
            />
          </Field>
          <Field label="Guardian phone">
            <Input
              value={form.guardianPhone}
              onChange={(e) => setField('guardianPhone', e.target.value)}
            />
          </Field>
          {!editing && (
            <>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={form.createLogin}
                  onChange={(checked) => setField('createLogin', checked)}
                />
                <span className="text-sm text-text-primary">Create login account</span>
              </label>
              {form.createLogin && (
                <>
                  <Field label="Username" required error={errors.username}>
                    <Input value={form.username} onChange={(e) => setField('username', e.target.value)} />
                  </Field>
                  <Field
                    label="Password"
                    hint="Leave blank to auto-generate a one-time password"
                    error={errors.password}
                  >
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => setField('password', e.target.value)}
                    />
                  </Field>
                  <Field label="Email (optional)">
                    <Input value={form.email} onChange={(e) => setField('email', e.target.value)} />
                  </Field>
                </>
              )}
            </>
          )}
          <Field
            label="Assign to Halqa (optional)"
            hint={editing ? undefined : "Auto-generates the student's initial Hifdh schedule"}
          >
            <Select
              value={form.halqaId}
              onChange={(e) => setField('halqaId', e.target.value)}
              placeholder="No Halqa"
              options={halqaOptions}
              disabled={halqasQuery.isLoading}
            />
          </Field>
          {!editing && form.halqaId && (
            <Field label="Hifdh start date" hint="Defaults to today if left blank">
              <Input
                type="date"
                value={form.hifdhStartDate}
                onChange={(e) => setField('hifdhStartDate', e.target.value)}
              />
            </Field>
          )}
          {editing && (
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setField('status', e.target.value as 'ACTIVE' | 'INACTIVE')}
                options={[
                  { label: 'ACTIVE', value: 'ACTIVE' },
                  { label: 'INACTIVE', value: 'INACTIVE' },
                ]}
              />
            </Field>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(credentials)}
        title="Student account created"
        onClose={() => setCredentials(null)}
        footer={<Button onClick={() => setCredentials(null)}>I have saved this password</Button>}
      >
        <div className="mb-4 rounded-card border border-amber/30 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-text-primary">This password is shown only once</p>
          <p className="mt-1 text-text-muted">
            Copy it now and share it securely with the new student. It cannot be retrieved again
            after closing this dialog.
          </p>
        </div>
        <p className="mb-2 text-sm font-medium text-text-primary">Temporary password:</p>
        <div className="mb-3 flex gap-2">
          <Input readOnly value={credentials?.temporaryPassword ?? ''} />
          <Button variant="outline" onClick={copyPassword}>
            <Copy className="h-4 w-4" />
            Copy
          </Button>
        </div>
        {credentials?.note && <p className="text-sm text-text-muted">{credentials.note}</p>}
      </Modal>

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => runBulkAction('delete')}
        title="Delete selected students?"
        message="This does not delete any linked login accounts, which will be left orphaned. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        isLoading={bulkAction.isPending}
      />
    </div>
  );
}
