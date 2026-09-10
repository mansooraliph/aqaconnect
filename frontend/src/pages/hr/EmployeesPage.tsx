import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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

function getErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data
    ?.message;
  return serverMessage ?? fallback;
}

interface Department {
  id: string;
  name: string;
}

interface Designation {
  id: string;
  name: string;
}

type EmployeeType = 'TEACHER' | 'ADMIN' | 'OFFICE_STAFF';

const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  TEACHER: 'Teacher',
  ADMIN: 'Admin',
  OFFICE_STAFF: 'Office Staff',
};

interface EmployeeUser {
  username: string;
  email: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  whatsapp: string | null;
  isActive: boolean;
}

interface Employee {
  id: string;
  employeeCode: string;
  employeeType: EmployeeType;
  dateOfJoining: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  departmentId: string | null;
  designationId: string | null;
  user: EmployeeUser;
  department: Department | null;
  designation: Designation | null;
}

interface FormValues {
  name: string;
  username: string;
  password: string;
  phone: string;
  whatsapp: string;
  email: string;
  employeeType: EmployeeType;
  employeeCode: string;
  departmentId: string;
  designationId: string;
  dateOfJoining: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const EMPTY_FORM: FormValues = {
  name: '',
  username: '',
  password: '',
  phone: '',
  whatsapp: '',
  email: '',
  employeeType: 'OFFICE_STAFF',
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
  const [typeFilter, setTypeFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');

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

  // Top-bar "Add Employee" shortcut lands here with ?new=1 to open the create modal directly.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openCreate();
      setSearchParams((prev) => {
        prev.delete('new');
        return prev;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const openEdit = (record: Employee) => {
    setEditing(record);
    setValues({
      ...EMPTY_FORM,
      employeeCode: record.employeeCode,
      employeeType: record.employeeType,
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
      if (!values.username) nextErrors.username = 'Username is required';
      if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) {
        nextErrors.email = 'Must be a valid email';
      }
      if (!values.password) {
        nextErrors.password = 'Password is required';
      }
      if (!values.name) nextErrors.name = 'Name is required';
    }
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
          // password is account-provisioning, not part of the Employee read-model
          // (see create payload below for the same mismatch).
          payload: {
            employeeCode: values.employeeCode || undefined,
            departmentId: values.departmentId || null,
            designationId: values.designationId || null,
            dateOfJoining: values.dateOfJoining || null,
            status: values.status,
            password: values.password || undefined,
          } as unknown as Partial<Employee>,
        });
        toast.success('Updated');
      } else {
        // Create payload includes account-provisioning fields (username/email/
        // password/name) that aren't part of the Employee read-model, so this
        // doesn't fit useBranchResource's Partial<Employee> typing.
        await create.mutateAsync({
          name: values.name,
          username: values.username,
          password: values.password,
          phone: values.phone || undefined,
          whatsapp: values.whatsapp || undefined,
          email: values.email || undefined,
          employeeType: values.employeeType,
          employeeCode: values.employeeCode || undefined,
          departmentId: values.departmentId || undefined,
          designationId: values.designationId || undefined,
          dateOfJoining: values.dateOfJoining || undefined,
        } as unknown as Partial<Employee>);
        toast.success('Created');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Something went wrong'));
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

  const data = (list.data ?? []).filter((e) => {
    if (typeFilter && e.employeeType !== typeFilter) return false;
    if (designationFilter && e.designationId !== designationFilter) return false;
    return true;
  });
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
      id: 'username',
      header: 'Username',
      cell: ({ row }) => row.original.user.username,
    },
    {
      id: 'phone',
      header: 'Mobile',
      cell: ({ row }) => row.original.user.phone ?? '-',
    },
    {
      id: 'email',
      header: 'Email',
      cell: ({ row }) => row.original.user.email,
    },
    {
      id: 'employeeType',
      header: 'Type',
      cell: ({ row }) => EMPLOYEE_TYPE_LABELS[row.original.employeeType],
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Field label="Type">
            <Select
              options={[
                { label: 'Teacher', value: 'TEACHER' },
                { label: 'Admin', value: 'ADMIN' },
                { label: 'Office Staff', value: 'OFFICE_STAFF' },
              ]}
              value={typeFilter}
              placeholder="All types"
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </Field>
        </div>
        <div className="w-48">
          <Field label="Designation">
            <Select
              options={designationOptions}
              value={designationFilter}
              placeholder="All designations"
              onChange={(e) => setDesignationFilter(e.target.value)}
            />
          </Field>
        </div>
        {(typeFilter || designationFilter) && (
          <Button variant="outline" size="sm" onClick={() => { setTypeFilter(''); setDesignationFilter(''); }}>
            Clear filters
          </Button>
        )}
      </div>

      <DataTable<Employee> columns={columns} data={data} isLoading={list.isLoading} searchable />

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Employee' : 'Add Employee'}
        onClose={handleCancel}
        position="right"
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
              <Field label="Name" required error={errors.name}>
                <Input
                  value={values.name}
                  onChange={(e) => setField('name', e.target.value)}
                />
              </Field>
              <Field label="Username" required error={errors.username} hint="Used to log in — doesn't need to be an email.">
                <Input
                  value={values.username}
                  onChange={(e) => setField('username', e.target.value)}
                />
              </Field>
              <Field label="Password" required error={errors.password}>
                <Input
                  type="password"
                  value={values.password}
                  onChange={(e) => setField('password', e.target.value)}
                />
              </Field>
              <Field label="Mobile">
                <Input
                  value={values.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                />
              </Field>
              <Field label="WhatsApp">
                <Input
                  value={values.whatsapp}
                  onChange={(e) => setField('whatsapp', e.target.value)}
                />
              </Field>
              <Field label="Email" error={errors.email}>
                <Input
                  type="email"
                  value={values.email}
                  onChange={(e) => setField('email', e.target.value)}
                />
              </Field>
              <Field label="User Type" required hint="Teacher also creates a linked Teacher record, so they show up in the Teachers list.">
                <Select
                  options={[
                    { label: 'Teacher', value: 'TEACHER' },
                    { label: 'Admin', value: 'ADMIN' },
                    { label: 'Office Staff', value: 'OFFICE_STAFF' },
                  ]}
                  value={values.employeeType}
                  onChange={(e) => setField('employeeType', e.target.value as EmployeeType)}
                />
              </Field>
            </>
          )}
          <Field label="Employee code" error={errors.employeeCode} hint="Auto-generated (next EMP###) when left blank.">
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
            <>
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
              <Field label="Reset password" error={errors.password} hint="Leave blank to keep the current password.">
                <Input
                  type="password"
                  value={values.password}
                  onChange={(e) => setField('password', e.target.value)}
                />
              </Field>
            </>
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
