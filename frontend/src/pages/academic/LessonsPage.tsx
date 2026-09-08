import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useGlobalResource } from '../../hooks/useResource';
import { CrudFormModal, type FieldDef } from '../../components/CrudFormModal';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Field } from '../../components/ui/Input';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { toast } from '../../components/ui/toast';

interface LessonStage {
  id: string;
  name: string;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
}

interface LessonSubStage {
  id: string;
  name: string;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  lessonStageId: string;
}

interface Lesson {
  id: string;
  lessonStageId: string;
  lessonSubStageId?: string | null;
  title: string;
  description?: string | null;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
}

const CREATE_LESSON_FIELDS: FieldDef[] = [
  { name: 'title', label: 'Title', type: 'text', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
];

const EDIT_LESSON_FIELDS: FieldDef[] = [
  { name: 'title', label: 'Title', type: 'text', required: true },
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

export function LessonsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManageLessons = hasPermission('academic.lessons.manage');

  const queryClient = useQueryClient();

  const { list: stagesList } = useGlobalResource<LessonStage>('lesson-stages');
  const stages = [...(stagesList.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const [stageId, setStageId] = useState<string>('');
  const [subStageId, setSubStageId] = useState<string>('');

  useEffect(() => {
    if (!stageId && stages.length > 0) {
      setStageId(stages[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages.length]);

  const subStagesQuery = useQuery({
    queryKey: ['lesson-sub-stages', stageId],
    queryFn: async () =>
      (
        await api.get<LessonSubStage[]>('/lesson-sub-stages', {
          params: { lessonStageId: stageId },
        })
      ).data,
    enabled: Boolean(stageId),
  });
  const subStages = [...(subStagesQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleStageChange = (value: string) => {
    setStageId(value);
    setSubStageId('');
  };

  const lessonsQueryKey = ['lessons', activeBranchId, stageId, subStageId];
  const lessonsQuery = useQuery({
    queryKey: lessonsQueryKey,
    queryFn: async () =>
      (
        await api.get<Lesson[]>(`/branches/${activeBranchId}/lessons`, {
          params: { lessonStageId: stageId, lessonSubStageId: subStageId || undefined },
        })
      ).data,
    enabled: Boolean(activeBranchId && stageId),
  });
  const lessons = [...(lessonsQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const invalidateLessons = () => queryClient.invalidateQueries({ queryKey: lessonsQueryKey });

  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [nextOrder, setNextOrder] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const openCreateLesson = async () => {
    const res = await api.get<{ nextOrder: number }>(`/branches/${activeBranchId}/lessons/next-order`, {
      params: { lessonStageId: stageId },
    });
    setNextOrder(res.data.nextOrder);
    setEditingLesson(null);
    setLessonModalOpen(true);
  };

  const openEditLesson = (record: Lesson) => {
    setEditingLesson(record);
    setLessonModalOpen(true);
  };

  const handleSubmitLesson = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      if (editingLesson) {
        await api.patch(`/branches/${activeBranchId}/lessons/${editingLesson.id}`, values);
        toast.success('Updated');
      } else {
        await api.post(`/branches/${activeBranchId}/lessons`, {
          ...values,
          sortOrder: nextOrder,
          lessonStageId: stageId,
          lessonSubStageId: subStageId || undefined,
        });
        toast.success('Created');
      }
      setLessonModalOpen(false);
      invalidateLessons();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const lessonColumns: ColumnDef<Lesson, unknown>[] = [
    { header: 'Title', accessorKey: 'title' },
    { header: 'Description', accessorKey: 'description' },
    { header: 'Order', accessorKey: 'sortOrder' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  if (canManageLessons) {
    lessonColumns.push({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" onClick={() => openEditLesson(row.original)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    });
  }

  return (
    <div className="rounded-card border border-border bg-white p-5">
      <PageHeader
        title="Lessons"
        variant="plain"
        actions={
          canManageLessons &&
          stageId && (
            <Button onClick={openCreateLesson}>
              <Plus className="h-4 w-4" />
              Add lesson
            </Button>
          )
        }
      />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Field label="Lesson stage">
          <Select
            placeholder="Select lesson stage"
            value={stageId}
            options={stages.map((s) => ({ label: s.name, value: s.id }))}
            onChange={(e) => handleStageChange(e.target.value)}
            disabled={stagesList.isLoading}
          />
        </Field>
        <Field label="Sub-stage">
          <Select
            placeholder="All sub-stages"
            value={subStageId}
            options={[{ label: 'All sub-stages', value: '' }, ...subStages.map((s) => ({ label: s.name, value: s.id }))]}
            onChange={(e) => setSubStageId(e.target.value)}
            disabled={!stageId || subStagesQuery.isLoading}
          />
        </Field>
      </div>
      <div className="mt-4">
        <DataTable<Lesson> columns={lessonColumns} data={lessons} isLoading={lessonsQuery.isLoading} />
      </div>
      <CrudFormModal
        open={lessonModalOpen}
        title={editingLesson ? 'Edit Lesson' : 'Add Lesson'}
        fields={editingLesson ? EDIT_LESSON_FIELDS : CREATE_LESSON_FIELDS}
        initialValues={editingLesson ? (editingLesson as unknown as Record<string, unknown>) : undefined}
        confirmLoading={submitting}
        onCancel={() => setLessonModalOpen(false)}
        onSubmit={handleSubmitLesson}
      />
    </div>
  );
}
