import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { CrudFormModal, type FieldDef } from '../../components/CrudFormModal';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { toast } from '../../components/ui/toast';
import { cn } from '../../lib/utils/cn';

interface Employee {
  id: string;
  employeeCode: string;
  user: { firstName: string; lastName: string; email: string };
}

interface Appreciation {
  id: string;
  employeeId: string;
  title: string;
  note: string | null;
  createdAt: string;
  employee: { user: { firstName: string; lastName: string } } | null;
}

interface Award {
  id: string;
  employeeId: string;
  title: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  employee: { user: { firstName: string; lastName: string } } | null;
}

interface EmployeeOption {
  label: string;
  value: string;
}

const TABS = [
  { key: 'appreciations', label: 'Appreciations' },
  { key: 'awards', label: 'Awards' },
] as const;

export function RecognitionPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canGiveAppreciation = hasPermission('hr.appreciations.create');
  const canGiveAward = hasPermission('hr.awards.create');
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['key']>('appreciations');

  const employeesQuery = useQuery({
    queryKey: ['employees', activeBranchId],
    queryFn: async () => (await api.get<Employee[]>(`/branches/${activeBranchId}/employees`)).data,
    enabled: Boolean(activeBranchId),
  });

  const employeeOptions: EmployeeOption[] = (employeesQuery.data ?? []).map((emp) => ({
    label: `${emp.user.firstName} ${emp.user.lastName} (${emp.employeeCode})`,
    value: emp.id,
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Recognition" variant="plain" />
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'border-blue text-blue'
                : 'border-transparent text-text-muted hover:text-text-primary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'appreciations' && (
        <AppreciationsTab
          activeBranchId={activeBranchId}
          employeeOptions={employeeOptions}
          employeesLoading={employeesQuery.isLoading}
          canManage={canGiveAppreciation}
        />
      )}
      {activeTab === 'awards' && (
        <AwardsTab
          activeBranchId={activeBranchId}
          employeeOptions={employeeOptions}
          employeesLoading={employeesQuery.isLoading}
          canManage={canGiveAward}
        />
      )}
    </div>
  );
}

function AppreciationsTab({
  activeBranchId,
  employeeOptions,
  employeesLoading,
  canManage,
}: {
  activeBranchId: string | undefined;
  employeeOptions: EmployeeOption[];
  employeesLoading: boolean;
  canManage: boolean;
}) {
  const { list, create } = useBranchResource<Appreciation>(activeBranchId, 'appreciations');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fields: FieldDef[] = [
    { name: 'employeeId', label: 'Employee', type: 'select', required: true, options: employeeOptions },
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'note', label: 'Note', type: 'textarea' },
  ];

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      await create.mutateAsync(values);
      toast.success('Appreciation given');
      setModalOpen(false);
    } catch {
      toast.error('Failed to give appreciation');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnDef<Appreciation, unknown>[] = [
    {
      id: 'employee',
      header: 'Employee',
      cell: ({ row }) =>
        row.original.employee
          ? `${row.original.employee.user.firstName} ${row.original.employee.user.lastName}`
          : '-',
    },
    {
      id: 'title',
      header: 'Title',
      accessorKey: 'title',
    },
    {
      id: 'note',
      header: 'Note',
      cell: ({ row }) => row.original.note ?? '-',
    },
    {
      id: 'createdAt',
      header: 'Date',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        {canManage && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} />
            Give appreciation
          </Button>
        )}
      </div>
      <DataTable<Appreciation>
        columns={columns}
        data={list.data ?? []}
        isLoading={list.isLoading || employeesLoading}
      />
      <CrudFormModal
        open={modalOpen}
        title="Give appreciation"
        fields={fields}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}

function AwardsTab({
  activeBranchId,
  employeeOptions,
  employeesLoading,
  canManage,
}: {
  activeBranchId: string | undefined;
  employeeOptions: EmployeeOption[];
  employeesLoading: boolean;
  canManage: boolean;
}) {
  const { list, create, update } = useBranchResource<Award>(activeBranchId, 'awards');
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fields: FieldDef[] = [
    { name: 'employeeId', label: 'Employee', type: 'select', required: true, options: employeeOptions },
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      await create.mutateAsync(values);
      toast.success('Award given');
      setModalOpen(false);
    } catch {
      toast.error('Failed to give award');
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (record: Award, status: Award['status']) => {
    setSavingId(record.id);
    try {
      await update.mutateAsync({ id: record.id, payload: { status } });
      queryClient.invalidateQueries({ queryKey: ['awards', activeBranchId] });
    } catch {
      toast.error('Failed to update award status');
    } finally {
      setSavingId(null);
    }
  };

  const columns: ColumnDef<Award, unknown>[] = [
    {
      id: 'employee',
      header: 'Employee',
      cell: ({ row }) =>
        row.original.employee
          ? `${row.original.employee.user.firstName} ${row.original.employee.user.lastName}`
          : '-',
    },
    {
      id: 'title',
      header: 'Title',
      accessorKey: 'title',
    },
    {
      id: 'description',
      header: 'Description',
      cell: ({ row }) => row.original.description ?? '-',
    },
    {
      id: 'createdAt',
      header: 'Date',
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const record = row.original;
        return canManage ? (
          <Select
            options={[
              { label: 'ACTIVE', value: 'ACTIVE' },
              { label: 'INACTIVE', value: 'INACTIVE' },
            ]}
            value={record.status}
            disabled={savingId === record.id}
            onChange={(e) => changeStatus(record, e.target.value as Award['status'])}
            className="h-8 w-[110px] text-xs"
          />
        ) : (
          <StatusBadge status={record.status} size="sm" />
        );
      },
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        {canManage && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} />
            Give award
          </Button>
        )}
      </div>
      <DataTable<Award>
        columns={columns}
        data={list.data ?? []}
        isLoading={list.isLoading || employeesLoading}
      />
      <CrudFormModal
        open={modalOpen}
        title="Give award"
        fields={fields}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
