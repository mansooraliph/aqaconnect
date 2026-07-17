import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Field, Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { toast } from '../../components/ui/toast';

interface EmployeeUser {
  email: string;
  firstName: string;
  lastName: string;
}

interface Employee {
  id: string;
  employeeCode: string;
  user: EmployeeUser;
}

interface TeacherUser {
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

interface Teacher {
  id: string;
  employeeCode: string | null;
  employeeId: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  user: TeacherUser;
  employee: Employee | null;
}

interface FormValues {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  employeeId: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const EMPTY_FORM: FormValues = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  employeeCode: '',
  employeeId: '',
  status: 'ACTIVE',
};

export function TeachersPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('hr.teachers.manage');

  const { list, create, update } = useBranchResource<Teacher>(activeBranchId, 'teachers');

  const employeesQuery = useQuery({
    queryKey: ['employees', activeBranchId],
    queryFn: async () => (await api.get<Employee[]>(`/branches/${activeBranchId}/employees`)).data,
    enabled: Boolean(activeBranchId),
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const employeeOptions = [
    { label: 'None', value: '' },
    ...(employeesQuery.data ?? []).map((e) => ({
      label: `${e.user.firstName} ${e.user.lastName} (${e.employeeCode})`,
      value: e.id,
    })),
  ];

  const setField = <K extends keyof FormValues>(name: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [name]: value }));
  };

  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      setValues({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        employeeCode: editing.employeeCode ?? '',
        employeeId: editing.employeeId ?? '',
        status: editing.status,
      });
    } else {
      setValues(EMPTY_FORM);
    }
    setErrors({});
  }, [modalOpen, editing]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (record: Teacher) => {
    setEditing(record);
    setModalOpen(true);
  };

  const handleCancel = () => {
    setModalOpen(false);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!editing) {
      if (!values.email || !/^\S+@\S+\.\S+$/.test(values.email)) {
        nextErrors.email = 'A valid email is required';
      }
      if (!values.password || values.password.length < 8) {
        nextErrors.password = 'Minimum 8 characters';
      }
      if (!values.firstName) {
        nextErrors.firstName = 'First name is required';
      }
      if (!values.lastName) {
        nextErrors.lastName = 'Last name is required';
      }
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
          payload: {
            employeeCode: values.employeeCode || undefined,
            employeeId: values.employeeId || null,
            status: values.status,
          },
        });
        toast.success('Updated');
      } else {
        // Create payload includes account-provisioning fields not part of
        // the Teacher read-model — see EmployeesPage's identical note.
        await create.mutateAsync({
          email: values.email,
          password: values.password,
          firstName: values.firstName,
          lastName: values.lastName,
          employeeCode: values.employeeCode || undefined,
          employeeId: values.employeeId || undefined,
        } as unknown as Partial<Teacher>);
        toast.success('Created');
      }
      setModalOpen(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnDef<Teacher, unknown>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => `${row.original.user.firstName} ${row.original.user.lastName}`,
    },
    {
      id: 'email',
      header: 'Email',
      accessorFn: (row) => row.user.email,
    },
    {
      id: 'employeeCode',
      header: 'Employee code',
      accessorKey: 'employeeCode',
      cell: ({ row }) => row.original.employeeCode ?? '-',
    },
    {
      id: 'linkedEmployee',
      header: 'Linked employee',
      cell: ({ row }) =>
        row.original.employee
          ? `${row.original.employee.user.firstName} ${row.original.employee.user.lastName}`
          : '-',
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  const allColumns: ColumnDef<Teacher, unknown>[] = canManage
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
        title="Teachers"
        variant="plain"
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add
            </Button>
          )
        }
      />
      <p className="text-sm text-text-muted">
        Teachers are staff records that provision a real login account. Optionally link a Teacher
        to an existing Employee record.
      </p>
      <DataTable<Teacher> columns={allColumns} data={list.data ?? []} isLoading={list.isLoading} />
      <Modal
        open={modalOpen}
        title={editing ? 'Edit Teacher' : 'Add Teacher'}
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
            </>
          )}
          <Field label="Employee code">
            <Input
              value={values.employeeCode}
              onChange={(e) => setField('employeeCode', e.target.value)}
            />
          </Field>
          <Field label="Linked employee">
            <Select
              options={employeeOptions}
              value={values.employeeId}
              onChange={(e) => setField('employeeId', e.target.value)}
              disabled={employeesQuery.isLoading}
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
    </div>
  );
}
