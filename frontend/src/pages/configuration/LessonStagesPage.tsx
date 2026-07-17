import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowUp, ArrowDown, Plus, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth';
import { useGlobalResource } from '../../hooks/useResource';
import { api } from '../../lib/api';
import { CrudFormModal, type FieldDef } from '../../components/CrudFormModal';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { toast } from '../../components/ui/toast';

interface LessonStage {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
}

interface LessonSubStage {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  lessonStageId: string;
}

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
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

interface SubStagesTableProps {
  stage: LessonStage;
  canManage: boolean;
}

/** Sub-stages of a single lesson stage, shown beneath the stage's summary row. */
function SubStagesTable({ stage, canManage }: SubStagesTableProps) {
  const queryClient = useQueryClient();
  const queryKey = ['lesson-sub-stages', stage.id];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await api.get<LessonSubStage[]>('/lesson-sub-stages', {
          params: { lessonStageId: stage.id },
        })
      ).data,
  });

  const subStages = [...(data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LessonSubStage | null>(null);
  const [nextOrder, setNextOrder] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const openCreate = async () => {
    const res = await api.get<{ nextOrder: number }>('/lesson-sub-stages/next-order', {
      params: { lessonStageId: stage.id },
    });
    setNextOrder(res.data.nextOrder);
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (record: LessonSubStage) => {
    setEditing(record);
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      if (editing) {
        await api.patch(`/lesson-sub-stages/${editing.id}`, values);
        toast.success('Updated');
      } else {
        await api.post('/lesson-sub-stages', {
          ...values,
          sortOrder: nextOrder,
          lessonStageId: stage.id,
        });
        toast.success('Created');
      }
      setModalOpen(false);
      invalidate();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const reorder = async (id: string, direction: 'up' | 'down') => {
    await api.post(`/lesson-sub-stages/${id}/reorder`, { direction });
    invalidate();
  };

  const columns: ColumnDef<LessonSubStage, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Description', accessorKey: 'description' },
    { header: 'Order', accessorKey: 'sortOrder' },
    {
      header: 'Status',
      id: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  if (canManage) {
    columns.push({
      header: '',
      id: 'actions',
      cell: ({ row }) => {
        const index = row.index;
        const record = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={index === 0}
              onClick={() => reorder(record.id, 'up')}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={index === subStages.length - 1}
              onClick={() => reorder(record.id, 'down')}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => openEdit(record)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    });
  }

  return (
    <div className="rounded-card border border-border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Sub-stages</h3>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add sub-stage
          </Button>
        )}
      </div>
      <DataTable<LessonSubStage>
        columns={columns}
        data={subStages}
        isLoading={isLoading}
        pagination={false}
      />
      <CrudFormModal
        open={modalOpen}
        title={editing ? 'Edit Sub-Stage' : 'Add Sub-Stage'}
        fields={FIELDS}
        initialValues={editing ? (editing as unknown as Record<string, unknown>) : undefined}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export function LessonStagesPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManageStages = hasPermission('configuration.lesson_stages.manage');
  const canManageSubStages = hasPermission('configuration.lesson_sub_stages.manage');

  const { list, create, update } = useGlobalResource<LessonStage>('lesson-stages');
  const stages = [...(list.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<LessonStage | null>(null);
  const [nextOrder, setNextOrder] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [expandedStageIds, setExpandedStageIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedStageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openCreateStage = async () => {
    const res = await api.get<{ nextOrder: number }>('/lesson-stages/next-order');
    setNextOrder(res.data.nextOrder);
    setEditingStage(null);
    setModalOpen(true);
  };

  const openEditStage = (stage: LessonStage) => {
    setEditingStage(stage);
    setModalOpen(true);
  };

  const handleSubmitStage = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      if (editingStage) {
        await update.mutateAsync({ id: editingStage.id, payload: values });
        toast.success('Updated');
      } else {
        await create.mutateAsync({ ...values, sortOrder: nextOrder });
        toast.success('Created');
      }
      setModalOpen(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const reorderStage = async (id: string, direction: 'up' | 'down') => {
    await api.post(`/lesson-stages/${id}/reorder`, { direction });
    list.refetch();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[18px] font-bold text-text-primary">Lesson Stages</h1>
        {canManageStages && (
          <Button onClick={openCreateStage}>
            <Plus className="h-4 w-4" />
            Add stage
          </Button>
        )}
      </div>

      {list.isLoading ? (
        <div className="rounded-card border border-border bg-white p-5 text-sm text-text-muted">
          Loading…
        </div>
      ) : stages.length === 0 ? (
        <div className="rounded-card border border-border bg-white p-5 text-sm text-text-muted">
          No lesson stages found.
        </div>
      ) : (
        stages.map((stage, index) => {
          const expanded = expandedStageIds.has(stage.id);
          return (
            <div key={stage.id} className="rounded-card border border-border bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => toggleExpanded(stage.id)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  {expanded ? (
                    <ChevronDown className="h-4 w-4 text-text-faint" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-text-faint" />
                  )}
                  <div>
                    <div className="text-sm font-semibold text-text-primary">{stage.name}</div>
                    {stage.description && (
                      <div className="text-xs text-text-muted">{stage.description}</div>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-muted">Order: {stage.sortOrder}</span>
                  <StatusBadge status={stage.status} />
                  {canManageStages && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={index === 0}
                        onClick={() => reorderStage(stage.id, 'up')}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={index === stages.length - 1}
                        onClick={() => reorderStage(stage.id, 'down')}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEditStage(stage)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {expanded && (
                <div className="mt-4">
                  <SubStagesTable stage={stage} canManage={canManageSubStages} />
                </div>
              )}
            </div>
          );
        })
      )}

      <CrudFormModal
        open={modalOpen}
        title={editingStage ? 'Edit Lesson Stage' : 'Add Lesson Stage'}
        fields={FIELDS}
        initialValues={editingStage ? (editingStage as unknown as Record<string, unknown>) : undefined}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmitStage}
      />
    </div>
  );
}
