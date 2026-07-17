import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Field, Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Checkbox } from '../../components/ui/Checkbox';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { toast } from '../../components/ui/toast';

interface Department {
  id: string;
  name: string;
}

interface Designation {
  id: string;
  name: string;
}

interface EmployeeUser {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
}

interface Employee {
  id: string;
  employeeCode: string;
  dateOfJoining: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  departmentId: string | null;
  designationId: string | null;
  user: EmployeeUser;
  department: Department | null;
  designation: Designation | null;
}

interface FormValues {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  employeeCode: string;
  departmentId: string;
  designationId: string;
  dateOfJoining: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const EMPTY_FORM: FormValues = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  employeeCode: '',
  departmentId: '',
  designationId: '',
  dateOfJoining: '',
  status: 'ACTIVE',
};

export function EmployeesPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('hr.employees.manage');
  const queryClient = useQueryClient();

  const { list, create, update, basePath, queryKey } = useBranchResource<Employee>(
    activeBranchId,
    'employees',
  );

  const departmentsQuery = useQuery({
    queryKey: ['departments', activeBranchId],
    queryFn: async () =>
      (await api.get<Department[]>(`/branches/${activeBranchId}/departments`)).data,
    enabled: Boolean(activeBranchId),
  });

  const designationsQuery = useQuery({
    queryKey: ['designations', activeBranchId],
    queryFn: async () =>
      (await api.get<Designation[]>(`/branches/${activeBranchId}/designations`)).data,
    enabled: Boolean(activeBranchId),
  });

  const bulkAction = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: 'activate' | 'deactivate' | 'delete' }) =>
      (await api.post(`${basePath}/bulk-action`, { ids, action })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const departmentOptions = (departmentsQuery.data ?? []).map((d) => ({ label: d.name, value: d.id }));
  const designationOptions = (designationsQuery.data ?? []).map((d) => ({ label: d.name, value: d.id }));

  const setField = <K extends keyof FormValues>(name: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [name]: value }));
  };

  const openCreate = () => {
    setEditing(null);
    setValues(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (record: Employee) => {
    setEditing(record);
    setValues({
      ...EMPTY_FORM,
      employeeCode: record.employeeCode,
      departmentId: record.departmentId ?? '',
      designationId: record.designationId ?? '',
      dateOfJoining: record.dateOfJoining ?? '',
      status: record.status,
    });
    setErrors({});
    setModalOpen(true);
  };

  const handleCancel = () => {
    setModalOpen(false);
    setErrors({});
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (!editing) {
      if (!values.email || !/^\S+@\S+\.\S+$/.test(values.email)) {
        nextErrors.email = 'A valid email is required';
      }
      if (!values.password || values.password.length < 8) {
        nextErrors.password = 'Minimum 8 characters';
      }
      if (!values.firstName) nextErrors.firstName = 'First name is required';
      if (!values.lastName) nextErrors.lastName = 'Last name is required';
    }
    if (!values.employeeCode) nextErrors.employeeCode = 'Employee code is required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          payload: {
            employeeCode: values.employeeCode,
            departmentId: values.departmentId || null,
            designationId: values.designationId || null,
            dateOfJoining: values.dateOfJoining || null,
            status: values.status,
          },
        });
        toast.success('Updated');
      } else {
        // Create payload includes account-provisioning fields (email/password/
        // firstName/lastName) that aren't part of the Employee read-model,
        // so this doesn't fit useBranchResource's Partial<Employee> typing.
        await create.mutateAsync({
          email: values.email,
          password: values.password,
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone || undefined,
          employeeCode: values.employeeCode,
          departmentId: values.departmentId || undefined,
          designationId: values.designationId || undefined,
          dateOfJoining: values.dateOfJoining || undefined,
        } as unknown as Partial<Employee>);
        toast.success('Created');
      }
      setModalOpen(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const runBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    try {
      await bulkAction.mutateAsync({ ids: selectedRowKeys, action });
      toast.success('Done');
      setSelectedRowKeys([]);
    } catch {
      toast.error('Bulk action failed');
    } finally {
      setDeleteConfirmOpen(false);
    }
  };

  const data = list.data ?? [];
  const allSelected = data.length > 0 && selectedRowKeys.length === data.length;
  const someSelected = selectedRowKeys.length > 0 && !allSelected;

  const toggleAll = (checked: boolean) => {
    setSelectedRowKeys(checked ? data.map((e) => e.id) : []);
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedRowKeys((keys) => (checked ? [...keys, id] : keys.filter((k) => k !== id)));
  };

  const columns: ColumnDef<Employee, unknown>[] = [
    ...(canManage
      ? [
          {
            id: 'select',
            header: () => (
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={toggleAll}
                aria-label="Select all"
              />
            ),
            cell: ({ row }: { row: { original: Employee } }) => (
              <Checkbox
                checked={selectedRowKeys.includes(row.original.id)}
                onChange={(checked) => toggleRow(row.original.id, checked)}
                aria-label="Select row"
              />
            ),
          } as ColumnDef<Employee, unknown>,
        ]
      : []),
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => `${row.original.user.firstName} ${row.original.user.lastName}`,
    },
    {
      id: 'email',
      header: 'Email',
      cell: ({ row }) => row.original.user.email,
    },
    { accessorKey: 'employeeCode', header: 'Employee code' },
    {
      id: 'department',
      header: 'Department',
      cell: ({ row }) => row.original.department?.name ?? '-',
    },
    {
      id: 'designation',
      header: 'Designation',
      cell: ({ row }) => row.original.designation?.name ?? '-',
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: '',
            cell: ({ row }: { row: { original: Employee } }) => (
              <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
                <Pencil className="h-4 w-4" />
              </Button>
            ),
          } as ColumnDef<Employee, unknown>,
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Employees"
        variant="plain"
        actions={
          <>
            {canManage && selectedRowKeys.length > 0 && (
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

      <p className="text-sm text-text-muted">
        Employees are staff records that provision a real login account. Departments and
        designations must be created first under Configuration.
      </p>

      <DataTable<Employee> columns={columns} data={data} isLoading={list.isLoading} />

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Employee' : 'Add Employee'}
        onClose={handleCancel}
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
          {!editing && (
            <>
              <Field label="Email" required error={errors.email}>
                <Input
                  type="email"
                  value={values.email}
                  onChange={(e) => setField('email', e.target.value)}
                />
              </Field>
              <Field label="Password" required error={errors.password}>
                <Input
                  type="password"
                  value={values.password}
                  onChange={(e) => setField('password', e.target.value)}
                />
              </Field>
              <Field label="First name" required error={errors.firstName}>
                <Input
                  value={values.firstName}
                  onChange={(e) => setField('firstName', e.target.value)}
                />
              </Field>
              <Field label="Last name" required error={errors.lastName}>
                <Input
                  value={values.lastName}
                  onChange={(e) => setField('lastName', e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={values.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                />
              </Field>
            </>
          )}
          <Field label="Employee code" required error={errors.employeeCode}>
            <Input
              value={values.employeeCode}
              onChange={(e) => setField('employeeCode', e.target.value)}
            />
          </Field>
          <Field label="Department">
            <Select
              options={departmentOptions}
              value={values.departmentId}
              placeholder={departmentsQuery.isLoading ? 'Loading…' : 'Select department'}
              onChange={(e) => setField('departmentId', e.target.value)}
            />
          </Field>
          <Field label="Designation">
            <Select
              options={designationOptions}
              value={values.designationId}
              placeholder={designationsQuery.isLoading ? 'Loading…' : 'Select designation'}
              onChange={(e) => setField('designationId', e.target.value)}
            />
          </Field>
          <Field label="Date of joining">
            <Input
              type="date"
              value={values.dateOfJoining}
              onChange={(e) => setField('dateOfJoining', e.target.value)}
            />
          </Field>
          {editing && (
            <Field label="Status">
              <Select
                options={[
                  { label: 'ACTIVE', value: 'ACTIVE' },
                  { label: 'INACTIVE', value: 'INACTIVE' },
                ]}
                value={values.status}
                onChange={(e) => setField('status', e.target.value as 'ACTIVE' | 'INACTIVE')}
              />
            </Field>
          )}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => runBulkAction('delete')}
        title="Delete selected employees?"
        message="This will also delete their login accounts. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        isLoading={bulkAction.isPending}
      />
    </div>
  );
}
