import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle2, Plus } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { CrudPage } from '../../components/CrudPage';
import { CrudFormModal, type FieldDef } from '../../components/CrudFormModal';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { toast } from '../../components/ui/toast';

interface ExamType {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface Exam {
  id: string;
  examTypeId: string;
  name: string;
  examDate: string;
  maxMarks: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  examType?: { name: string };
}

type ResultStatus = 'DRAFT' | 'PUBLISHED';

interface StudentExamResult {
  id: string;
  studentId: string;
  marksObtained: number;
  remark: string | null;
  status: ResultStatus;
  student: {
    name: string;
    studentCode: string;
  };
}

interface UnmarkedStudent {
  id: string;
  name: string;
  studentCode: string;
}

function getErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data
    ?.message;
  return serverMessage ?? fallback;
}

function ExamTypesTab() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('academic.exam_types.manage');
  const { list, create, update } = useBranchResource<ExamType>(activeBranchId, 'exam-types');

  const columns: ColumnDef<ExamType, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  const fields: FieldDef[] = [
    { name: 'name', label: 'Name', type: 'text', required: true },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      editOnly: true, // Create DTO doesn't accept status — new exam types default to ACTIVE server-side
      options: [
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Inactive', value: 'INACTIVE' },
      ],
    },
  ];

  return (
    <CrudPage<ExamType>
      title="Exam Types"
      description="Categories of exams (e.g. Monthly Test, Final Exam)."
      data={list.data}
      loading={list.isLoading}
      columns={columns}
      fields={fields}
      onCreate={(values) => create.mutateAsync(values)}
      onUpdate={(id, values) => update.mutateAsync({ id, payload: values })}
      canManage={canManage}
    />
  );
}

function ExamResultsPanel({ exam }: { exam: Exam }) {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canEnter = hasPermission('academic.exam_results.enter');
  const canPublish = hasPermission('academic.exam_results.publish');
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishingAll, setPublishingAll] = useState(false);
  const [entries, setEntries] = useState<Record<string, { marksObtained: number | null; remark: string }>>({});

  const basePath = `/branches/${activeBranchId}/exams/${exam.id}/results`;
  const resultsQueryKey = ['exam-results', activeBranchId, exam.id];
  const unmarkedQueryKey = ['exam-unmarked-students', activeBranchId, exam.id];

  const resultsQuery = useQuery({
    queryKey: resultsQueryKey,
    queryFn: async () => (await api.get<StudentExamResult[]>(basePath)).data,
    enabled: Boolean(activeBranchId),
  });

  const unmarkedQuery = useQuery({
    queryKey: unmarkedQueryKey,
    queryFn: async () =>
      (await api.get<UnmarkedStudent[]>(`${basePath}/unmarked-students`)).data,
    enabled: Boolean(activeBranchId),
  });

  const results = resultsQuery.data ?? [];
  const unmarked = unmarkedQuery.data ?? [];

  useEffect(() => {
    setEntries((prev) => {
      const next: Record<string, { marksObtained: number | null; remark: string }> = {};
      for (const s of unmarked) {
        next[s.id] = prev[s.id] ?? { marksObtained: null, remark: '' };
      }
      return next;
    });
  }, [unmarked]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: resultsQueryKey });
    queryClient.invalidateQueries({ queryKey: unmarkedQueryKey });
  };

  const setEntry = (studentId: string, patch: Partial<{ marksObtained: number | null; remark: string }>) => {
    setEntries((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? { marksObtained: null, remark: '' }), ...patch },
    }));
  };

  const handleBulkSubmit = async () => {
    const payload = Object.entries(entries)
      .filter(([, v]) => v.marksObtained !== null && v.marksObtained !== undefined)
      .map(([studentId, v]) => ({
        studentId,
        marksObtained: v.marksObtained as number,
        remark: v.remark || undefined,
      }));
    if (payload.length === 0) {
      toast.error('Enter marks for at least one student');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`${basePath}/bulk-entry`, { results: payload });
      toast.success('Results saved');
      setEntries({});
      refreshAll();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save results'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishAll = async () => {
    setPublishingAll(true);
    try {
      await api.post(`${basePath}/publish`, {});
      toast.success('All draft results published');
      refreshAll();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to publish results'));
    } finally {
      setPublishingAll(false);
    }
  };

  const handlePublishOne = async (studentId: string) => {
    setPublishingId(studentId);
    try {
      await api.post(`${basePath}/publish`, { studentIds: [studentId] });
      toast.success('Result published');
      refreshAll();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to publish result'));
    } finally {
      setPublishingId(null);
    }
  };

  const resultColumns: ColumnDef<StudentExamResult, unknown>[] = [
    {
      header: 'Student',
      cell: ({ row }) =>
        `${row.original.student.name} (${row.original.student.studentCode})`,
    },
    { header: 'Marks', accessorKey: 'marksObtained' },
    { header: 'Remark', accessorKey: 'remark' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    ...(canPublish
      ? ([
          {
            id: 'actions',
            header: '',
            cell: ({ row }: { row: { original: StudentExamResult } }) =>
              row.original.status === 'DRAFT' ? (
                <Button
                  size="sm"
                  variant="outline"
                  loading={publishingId === row.original.studentId}
                  onClick={() => handlePublishOne(row.original.studentId)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Publish
                </Button>
              ) : null,
          },
        ] as ColumnDef<StudentExamResult, unknown>[])
      : []),
  ];

  const unmarkedColumns: ColumnDef<UnmarkedStudent, unknown>[] = [
    {
      header: 'Student',
      cell: ({ row }) => `${row.original.name} (${row.original.studentCode})`,
    },
    {
      header: exam.maxMarks != null ? `Marks (max ${exam.maxMarks})` : 'Marks',
      cell: ({ row }) => (
        <Input
          type="number"
          min={0}
          max={exam.maxMarks ?? undefined}
          value={entries[row.original.id]?.marksObtained ?? ''}
          onChange={(e) =>
            setEntry(row.original.id, {
              marksObtained: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          placeholder="Marks"
        />
      ),
    },
    {
      header: 'Remark',
      cell: ({ row }) => (
        <Input
          value={entries[row.original.id]?.remark ?? ''}
          onChange={(e) => setEntry(row.original.id, { remark: e.target.value })}
          placeholder="Optional"
        />
      ),
    },
  ];

  return (
    <div className="mt-4 rounded-card border border-border bg-white p-5">
      <PageHeader
        title={`Results — ${exam.name}`}
        variant="plain"
        actions={
          canPublish && (
            <Button loading={publishingAll} onClick={handlePublishAll}>
              <CheckCircle2 className="h-4 w-4" />
              Publish all
            </Button>
          )
        }
      />
      {exam.maxMarks != null && (
        <p className="mt-2 text-sm text-text-muted">Max marks: {exam.maxMarks}</p>
      )}
      <h3 className="mb-2 mt-4 text-sm font-semibold text-text-primary">Entered results</h3>
      <DataTable<StudentExamResult>
        columns={resultColumns}
        data={results}
        isLoading={resultsQuery.isLoading}
      />

      {canEnter && (
        <>
          <h3 className="mb-2 mt-6 text-sm font-semibold text-text-primary">
            Enter marks — students without results
          </h3>
          {unmarked.length === 0 ? (
            <div className="rounded-card border border-border bg-table-alt p-4 text-sm text-text-muted">
              No unmarked students remaining for this exam.
            </div>
          ) : (
            <>
              <DataTable<UnmarkedStudent> columns={unmarkedColumns} data={unmarked} pagination={false} />
              <Button className="mt-4" onClick={handleBulkSubmit} loading={submitting}>
                <Plus className="h-4 w-4" />
                Save marks
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ExamsTab() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('academic.exams.manage');
  const { list, create, update } = useBranchResource<Exam>(activeBranchId, 'exams');

  const examTypesQuery = useQuery({
    queryKey: ['exam-types', activeBranchId],
    queryFn: async () => (await api.get<ExamType[]>(`/branches/${activeBranchId}/exam-types`)).data,
    enabled: Boolean(activeBranchId),
  });

  const examTypeOptions = (examTypesQuery.data ?? []).map((t) => ({ label: t.name, value: t.id }));

  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (record: Exam) => {
    setEditing(record);
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, payload: values });
        toast.success('Exam updated');
      } else {
        await create.mutateAsync(values);
        toast.success('Exam created');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Something went wrong'));
    } finally {
      setSubmitting(false);
    }
  };

  const createFields: FieldDef[] = [
    { name: 'examTypeId', label: 'Exam Type', type: 'select', required: true, options: examTypeOptions },
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'examDate', label: 'Exam date', type: 'date', required: true },
    { name: 'maxMarks', label: 'Max marks', type: 'number' },
  ];

  const editFields: FieldDef[] = [
    ...createFields,
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

  const selectedExam = (list.data ?? []).find((e) => e.id === selectedExamId) ?? null;

  const columns: ColumnDef<Exam, unknown>[] = [
    {
      header: 'Exam Type',
      cell: ({ row }) => row.original.examType?.name ?? row.original.examTypeId,
    },
    { header: 'Name', accessorKey: 'name' },
    {
      header: 'Date',
      accessorKey: 'examDate',
      cell: ({ row }) => new Date(row.original.examDate).toLocaleDateString(),
    },
    { header: 'Max marks', accessorKey: 'maxMarks' },
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
          <Button size="sm" variant="outline" onClick={() => setSelectedExamId(row.original.id)}>
            Enter/View results
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

  return (
    <>
      <PageHeader
        title="Exams"
        variant="plain"
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Exam
            </Button>
          )
        }
      />
      <DataTable<Exam>
        columns={columns}
        data={list.data ?? []}
        isLoading={list.isLoading || examTypesQuery.isLoading}
      />
      <CrudFormModal
        open={modalOpen}
        title={editing ? 'Edit Exam' : 'Add Exam'}
        fields={editing ? editFields : createFields}
        initialValues={
          editing
            ? {
                examTypeId: editing.examTypeId,
                name: editing.name,
                examDate: editing.examDate,
                maxMarks: editing.maxMarks ?? undefined,
                status: editing.status,
              }
            : undefined
        }
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
      {selectedExam && <ExamResultsPanel exam={selectedExam} />}
    </>
  );
}

export function ExamsPage() {
  const [tab, setTab] = useState<'exam-types' | 'exams'>('exams');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-border">
        {(
          [
            { key: 'exam-types', label: 'Exam Types' },
            { key: 'exams', label: 'Exams' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? 'border-b-2 border-blue px-4 py-2 text-sm font-medium text-blue'
                : 'border-b-2 border-transparent px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary'
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'exam-types' ? <ExamTypesTab /> : <ExamsTab />}
    </div>
  );
}
