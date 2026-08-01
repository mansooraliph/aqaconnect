import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { CrudFormModal, type FieldDef } from '../../components/CrudFormModal';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/toast';

interface Teacher {
  id: string;
  user: {
    firstName: string;
    lastName: string;
  };
}

interface HalqaStudent {
  student: {
    id: string;
    name: string;
    studentCode: string;
  };
}

type HalqaStatus = 'ACTIVE' | 'INACTIVE';

interface Halqa {
  id: string;
  name: string;
  teacherId: string | null;
  status: HalqaStatus;
  teacher: {
    user: {
      firstName: string;
      lastName: string;
    };
  } | null;
  students: HalqaStudent[];
}

interface UnassignedStudent {
  id: string;
  name: string;
  studentCode: string;
}

function getErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data
    ?.message;
  return serverMessage ?? fallback;
}

export function HalqasPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = hasPermission('academic.halqas.view');
  const canManage = hasPermission('academic.halqas.manage');

  const { list, create, update, basePath } = useBranchResource<Halqa>(activeBranchId, 'halqas');
  const halqas = list.data ?? [];

  const teachersQuery = useQuery({
    queryKey: ['teachers', activeBranchId],
    queryFn: async () => (await api.get<Teacher[]>(`/branches/${activeBranchId}/teachers`)).data,
    enabled: Boolean(activeBranchId),
  });

  const teacherOptions = (teachersQuery.data ?? []).map((t) => ({
    label: `${t.user.firstName} ${t.user.lastName}`,
    value: t.id,
  }));

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Halqa | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (halqa: Halqa) => {
    setEditing(halqa);
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, payload: values });
        toast.success('Halqa updated');
      } else {
        await create.mutateAsync(values);
        toast.success('Halqa created');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Something went wrong'));
    } finally {
      setSubmitting(false);
    }
  };

  const createFields: FieldDef[] = [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'teacherId', label: 'Teacher', type: 'select', options: teacherOptions },
  ];

  const editFields: FieldDef[] = [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'teacherId', label: 'Teacher', type: 'select', options: teacherOptions },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      options: [
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Inactive', value: 'INACTIVE' },
      ],
    },
  ];

  // --- Roster management modal ---
  const [rosterTarget, setRosterTarget] = useState<Halqa | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const unassignedQuery = useQuery({
    queryKey: ['halqas', activeBranchId, rosterTarget?.id, 'unassigned-students'],
    queryFn: async () =>
      (
        await api.get<UnassignedStudent[]>(`${basePath}/${rosterTarget?.id}/unassigned-students`)
      ).data,
    enabled: Boolean(activeBranchId && rosterTarget),
  });

  const openRoster = (halqa: Halqa) => {
    setRosterTarget(halqa);
    setSelectedStudentId('');
  };

  const closeRoster = () => {
    setRosterTarget(null);
    setSelectedStudentId('');
  };

  const currentRoster = halqas.find((h) => h.id === rosterTarget?.id)?.students ?? [];

  const unassignedOptions = (unassignedQuery.data ?? []).map((s) => ({
    label: `${s.name} (${s.studentCode})`,
    value: s.id,
  }));

  const handleAssign = async () => {
    if (!rosterTarget || !selectedStudentId) return;
    setAssigning(true);
    try {
      await api.post(`${basePath}/${rosterTarget.id}/assign-student`, {
        studentId: selectedStudentId,
      });
      toast.success('Student added to roster');
      setSelectedStudentId('');
      list.refetch();
      unassignedQuery.refetch();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to add student'));
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async (studentId: string) => {
    if (!rosterTarget) return;
    setRemovingId(studentId);
    try {
      await api.post(`${basePath}/${rosterTarget.id}/remove-student`, { studentId });
      toast.success('Student removed from roster');
      list.refetch();
      unassignedQuery.refetch();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to remove student'));
    } finally {
      setRemovingId(null);
    }
  };

  const columns: ColumnDef<Halqa, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Teacher',
      cell: ({ row }) =>
        row.original.teacher
          ? `${row.original.teacher.user.firstName} ${row.original.teacher.user.lastName}`
          : 'Unassigned',
    },
    {
      header: 'Students',
      cell: ({ row }) => row.original.students.length,
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openRoster(row.original)}>
            Manage roster
          </Button>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => openEdit(row.original)}>
              Edit
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (!canView) {
    return (
      <div className="rounded-card border border-border bg-white p-5">
        <PageHeader title="Halqas" variant="plain" />
        <p className="mt-3 text-sm text-text-muted">
          You do not have permission to view halqas.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Halqas"
        variant="plain"
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Halqa
            </Button>
          )
        }
      />
      <DataTable<Halqa>
        columns={columns}
        data={halqas}
        isLoading={list.isLoading || teachersQuery.isLoading}
      />
      <CrudFormModal
        open={modalOpen}
        title={editing ? 'Edit Halqa' : 'Add Halqa'}
        fields={editing ? editFields : createFields}
        initialValues={
          editing
            ? {
                name: editing.name,
                teacherId: editing.teacherId ?? undefined,
                status: editing.status,
              }
            : undefined
        }
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
      <Modal
        open={Boolean(rosterTarget)}
        title={rosterTarget ? `Manage roster — ${rosterTarget.name}` : 'Manage roster'}
        onClose={closeRoster}
      >
        <div className="flex flex-col gap-4">
          {canManage && (
            <div className="flex items-center gap-2">
              <Select
                className="flex-1"
                placeholder="Select a student to add"
                options={unassignedOptions}
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={unassignedQuery.isLoading}
              />
              <Button onClick={handleAssign} loading={assigning} disabled={!selectedStudentId}>
                Add
              </Button>
            </div>
          )}
          {currentRoster.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
              {currentRoster.map((item) => (
                <li
                  key={item.student.id}
                  className="flex items-center justify-between px-3 py-2 text-sm text-text-primary"
                >
                  <span>
                    {item.student.name} ({item.student.studentCode})
                  </span>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={removingId === item.student.id}
                      onClick={() => handleRemove(item.student.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No students in this Halqa</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
