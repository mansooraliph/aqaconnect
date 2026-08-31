import type { ColumnDef } from '@tanstack/react-table';
import { useBranchResource } from '../../hooks/useResource';
import { useAuthStore } from '../../store/auth';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';

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
  username: string;
  email: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
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

const columns: ColumnDef<Teacher, unknown>[] = [
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
    id: 'employeeCode',
    header: 'Employee code',
    cell: ({ row }) => row.original.employeeCode ?? '-',
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

export function TeachersPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const { list } = useBranchResource<Teacher>(activeBranchId, 'teachers');

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Teachers" variant="plain" />
      <p className="text-sm text-text-muted">
        Teacher accounts are provisioned from Employees — add an employee there with type
        "Teacher" to have them appear here.
      </p>
      <DataTable<Teacher> columns={columns} data={list.data ?? []} isLoading={list.isLoading} />
    </div>
  );
}
