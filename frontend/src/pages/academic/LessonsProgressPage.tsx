import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Undo2 } from 'lucide-react';
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
import { ConfirmModal } from '../../components/ui/ConfirmModal';
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

interface Student {
  id: string;
  studentCode: string;
  name: string;
}

type ProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';

interface StudentLessonProgress {
  id: string;
  studentId: string;
  lessonId: string;
  status: ProgressStatus;
  student?: { name: string; studentCode: string };
  lesson?: { title: string };
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

function getErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data
    ?.message;
  return serverMessage ?? fallback;
}

export function LessonsProgressPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManageLessons = hasPermission('academic.lessons.manage');
  const canMarkProgress = hasPermission('academic.lesson_progress.mark');
  const canVerifyProgress = hasPermission('academic.lesson_progress.verify');

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

  // --- Student progress tracking ---

  const [studentId, setStudentId] = useState<string>('');

  const studentsQuery = useQuery({
    queryKey: ['students', activeBranchId],
    queryFn: async () => (await api.get<Student[]>(`/branches/${activeBranchId}/students`)).data,
    enabled: Boolean(activeBranchId),
  });
  const studentOptions = (studentsQuery.data ?? []).map((s) => ({
    label: `${s.name} (${s.studentCode})`,
    value: s.id,
  }));

  const progressQueryKey = ['student-lesson-progress', activeBranchId, studentId];
  const progressQuery = useQuery({
    queryKey: progressQueryKey,
    queryFn: async () =>
      (
        await api.get<StudentLessonProgress[]>(
          `/branches/${activeBranchId}/student-lesson-progress`,
          { params: { studentId } },
        )
      ).data,
    enabled: Boolean(activeBranchId && studentId),
  });
  const invalidateProgress = () => queryClient.invalidateQueries({ queryKey: progressQueryKey });

  const progressByLessonId = new Map(
    (progressQuery.data ?? []).map((p) => [p.lessonId, p] as const),
  );

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);

  const startProgress = async (lessonId: string) => {
    if (!studentId) return;
    setActionLoadingId(lessonId);
    try {
      await api.post(`/branches/${activeBranchId}/student-lesson-progress`, {
        studentId,
        lessonId,
      });
      toast.success('Started tracking progress');
      invalidateProgress();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to start tracking progress'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const markProgress = async (id: string, status: 'IN_PROGRESS' | 'COMPLETED') => {
    setActionLoadingId(id);
    try {
      await api.post(`/branches/${activeBranchId}/student-lesson-progress/${id}/mark`, { status });
      toast.success('Progress updated');
      invalidateProgress();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update progress'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const verifyProgress = async (id: string) => {
    setActionLoadingId(id);
    try {
      await api.post(`/branches/${activeBranchId}/student-lesson-progress/${id}/verify`);
      toast.success('Progress verified');
      invalidateProgress();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to verify progress'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const resetProgress = async (id: string) => {
    setActionLoadingId(id);
    try {
      await api.post(`/branches/${activeBranchId}/student-lesson-progress/${id}/reset`);
      toast.success('Progress reset');
      invalidateProgress();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to reset progress'));
    } finally {
      setActionLoadingId(null);
      setResetTargetId(null);
    }
  };

  interface ProgressRow {
    lesson: Lesson;
    progress?: StudentLessonProgress;
  }

  const progressRows: ProgressRow[] = lessons.map((lesson) => ({
    lesson,
    progress: progressByLessonId.get(lesson.id),
  }));

  const progressColumns: ColumnDef<ProgressRow, unknown>[] = [
    { header: 'Lesson', cell: ({ row }) => row.original.lesson.title },
    {
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.progress?.status ?? 'NOT_STARTED'} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const status = row.original.progress?.status;
        const loading = actionLoadingId === (row.original.progress?.id ?? row.original.lesson.id);

        if (!status) {
          return canMarkProgress ? (
            <Button size="sm" variant="outline" loading={loading} onClick={() => startProgress(row.original.lesson.id)}>
              Start
            </Button>
          ) : null;
        }

        const progressId = row.original.progress!.id;
        const locked = status === 'VERIFIED';

        return (
          <div className="flex flex-wrap items-center gap-2">
            {canMarkProgress && status === 'NOT_STARTED' && (
              <Button size="sm" variant="outline" loading={loading} onClick={() => markProgress(progressId, 'IN_PROGRESS')}>
                Mark In Progress
              </Button>
            )}
            {canMarkProgress && status === 'IN_PROGRESS' && (
              <Button size="sm" variant="outline" loading={loading} onClick={() => markProgress(progressId, 'COMPLETED')}>
                Mark Completed
              </Button>
            )}
            {canVerifyProgress && (
              <Button
                size="sm"
                disabled={status !== 'COMPLETED'}
                loading={loading}
                onClick={() => verifyProgress(progressId)}
              >
                Verify
              </Button>
            )}
            {canMarkProgress && !locked && (
              <Button
                size="sm"
                variant="danger"
                loading={loading}
                onClick={() => setResetTargetId(progressId)}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
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

      <div className="rounded-card border border-border bg-white p-5">
        <h2 className="text-[18px] font-bold leading-tight text-text-primary">Track student progress</h2>
        <p className="mt-2 text-sm text-text-muted">
          Select a student to view and update their progress on the lessons in the selected stage
          / sub-stage above.
        </p>
        <div className="mt-3">
          <Field label="Student">
            <Select
              placeholder="Select student"
              value={studentId}
              options={studentOptions}
              onChange={(e) => setStudentId(e.target.value)}
              disabled={studentsQuery.isLoading}
            />
          </Field>
        </div>
        <div className="mt-4">
          <DataTable<ProgressRow>
            columns={progressColumns}
            data={progressRows}
            isLoading={lessonsQuery.isLoading || (Boolean(studentId) && progressQuery.isLoading)}
            emptyMessage={studentId ? 'No lessons found' : 'Select a student to track progress'}
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(resetTargetId)}
        onClose={() => setResetTargetId(null)}
        onConfirm={() => resetTargetId && resetProgress(resetTargetId)}
        title="Reset progress"
        message="Reset this student's progress on this lesson?"
        confirmLabel="Reset"
        confirmVariant="danger"
        isLoading={Boolean(resetTargetId && actionLoadingId === resetTargetId)}
      />
    </div>
  );
}
