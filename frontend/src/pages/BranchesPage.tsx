import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Pencil } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useGlobalResource } from '../hooks/useResource';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { CrudFormModal, type FieldDef } from '../components/CrudFormModal';
import { toast } from '../components/ui/toast';

interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
}

const CREATE_FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'code', label: 'Code', type: 'text', required: true },
  { name: 'address', label: 'Address', type: 'text' },
  { name: 'phone', label: 'Phone', type: 'text' },
  { name: 'email', label: 'Email', type: 'text' },
];

const STATUS_FIELD: FieldDef = {
  name: 'isActive',
  label: 'Status',
  type: 'select',
  required: true,
  options: [
    { label: 'Active', value: 'true' },
    { label: 'Inactive', value: 'false' },
  ],
};

export function BranchesPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = hasPermission('system.branches.view');
  const canManage = hasPermission('system.branches.manage');
  const { list, create, update } = useGlobalResource<Branch>('branches');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditing(branch);
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      if (editing) {
        const payload: Record<string, unknown> = { ...values };
        if (typeof payload.isActive === 'string') {
          payload.isActive = payload.isActive === 'true';
        }
        await update.mutateAsync({ id: editing.id, payload });
        toast.success('Branch updated');
      } else {
        await create.mutateAsync(values);
        toast.success('Branch created');
      }
      setModalOpen(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const fields: FieldDef[] = editing ? [...CREATE_FIELDS, STATUS_FIELD] : CREATE_FIELDS;
  const initialValues = editing
    ? { ...editing, isActive: editing.isActive ? 'true' : 'false' }
    : undefined;

  const columns: ColumnDef<Branch, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Code', accessorKey: 'code' },
    { header: 'Phone', accessorKey: 'phone', cell: ({ row }) => row.original.phone ?? '—' },
    { header: 'Email', accessorKey: 'email', cell: ({ row }) => row.original.email ?? '—' },
    {
      header: 'Status',
      id: 'isActive',
      cell: ({ row }) => <StatusBadge status={row.original.isActive ? 'ACTIVE' : 'INACTIVE'} />,
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: '',
            cell: ({ row }: { row: { original: Branch } }) => (
              <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
                <Pencil className="h-4 w-4" />
              </Button>
            ),
          } satisfies ColumnDef<Branch, unknown>,
        ]
      : []),
  ];

  if (!canView) {
    return <p className="text-sm text-text-muted">You do not have permission to view this page.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Branches"
        variant="plain"
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Branch
            </Button>
          )
        }
      />
      <p className="-mt-2 text-sm text-text-muted">All branches/campuses in the organization.</p>
      <DataTable<Branch> columns={columns} data={list.data ?? []} isLoading={list.isLoading} />
      <CrudFormModal
        open={modalOpen}
        title={editing ? 'Edit Branch' : 'Add Branch'}
        fields={fields}
        initialValues={initialValues}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
