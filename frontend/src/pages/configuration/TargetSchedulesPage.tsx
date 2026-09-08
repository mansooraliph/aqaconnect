import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { FileDown, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Modal } from '../../components/ui/Modal';
import { Field, Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { FilterSelect } from '../../components/ui/FilterSelect';
import { toast } from '../../components/ui/toast';
import { useAuthStore } from '../../store/auth';
import { useGlobalResource } from '../../hooks/useResource';
import { CrudFormModal, type FieldDef } from '../../components/CrudFormModal';
import { api } from '../../lib/api';

interface Surah {
  id: string;
  number: number;
  nameEnglish: string;
}

interface TargetScheduleRow {
  id: string;
  dayNumber: number;
  stage: 'HIFDH' | 'DOURA' | 'REVISION' | null;
  surahId: string | null;
  pageNumberFrom: number | null;
  pageNumberTo: number | null;
  lineFrom: number | null;
  lineTo: number | null;
  portionDescription: string | null;
  fromAyah: number | null;
  toAyah: number | null;
  estimatedDurationMinutes: number | null;
  difficultyLevel: 'VERY_EASY' | 'EASY' | 'MEDIUM' | 'HARD' | 'VERY_HARD' | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | null;
  scheduleType: string | null;
  examName: string | null;
}

const SCHEDULE_TYPE_OPTIONS = [
  { label: 'Hifdh', value: 'Hifdh' },
  { label: 'Preparation', value: 'Preparation' },
  { label: 'Exam', value: 'Exam' },
];

export function TargetSchedulesPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('configuration.target_schedules.manage');
  const queryClient = useQueryClient();
  const { list, create } = useGlobalResource<TargetScheduleRow>('surah-target-schedules');

  const surahsQuery = useQuery({
    queryKey: ['surahs'],
    queryFn: async () => (await api.get<Surah[]>('/surahs')).data,
  });

  const surahOptions = (surahsQuery.data ?? []).map((s) => ({
    label: `${s.number}. ${s.nameEnglish}`,
    value: s.id,
  }));

  // ---- Filters ----
  const [filterSurahId, setFilterSurahId] = useState('');
  const [filterType, setFilterType] = useState('');

  // Preserves the order returned by the server (import/insertion order via
  // sortOrder) — do not re-sort by day, since a day can have many rows and
  // their original sequence matters.
  const rows = useMemo(() => {
    return (list.data ?? [])
      .filter((r) => !filterSurahId || r.surahId === filterSurahId)
      .filter((r) => !filterType || r.scheduleType === filterType);
  }, [list.data, filterSurahId, filterType]);

  const typeOptions = SCHEDULE_TYPE_OPTIONS;

  // ---- Inline editing ----
  const [savingId, setSavingId] = useState<string | null>(null);

  const patchRow = async (row: TargetScheduleRow, patch: Record<string, unknown>) => {
    setSavingId(row.id);
    try {
      await api.patch(`/surah-target-schedules/${row.id}`, patch);
      queryClient.invalidateQueries({ queryKey: ['surah-target-schedules'] });
    } catch {
      toast.error('Failed to save change');
    } finally {
      setSavingId(null);
    }
  };

  // ---- Create (new rows still go through a small modal — inline editing applies to existing rows) ----
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const CREATE_FIELDS: FieldDef[] = [
    { name: 'dayNumber', label: 'Day', type: 'number', required: true },
    { name: 'surahId', label: 'Surah', type: 'select', options: surahOptions },
    { name: 'fromAyah', label: 'Verse from', type: 'number' },
    { name: 'toAyah', label: 'Verse to', type: 'number' },
    { name: 'scheduleType', label: 'Schedule type', type: 'select', options: SCHEDULE_TYPE_OPTIONS },
    { name: 'examName', label: 'Exam name', type: 'text' },
  ];

  const handleCreate = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      await create.mutateAsync(values);
      toast.success('Created');
      setModalOpen(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Import ----
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Choose a file to import');
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const { data } = await api.post<{ imported: number }>('/surah-target-schedules/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Imported ${data.imported} row(s), replacing the previous schedule`);
      setImportOpen(false);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['surah-target-schedules'] });
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to import file';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setImporting(false);
    }
  };

  // ---- Download the originally imported workbook (as uploaded) ----
  const [downloadingImport, setDownloadingImport] = useState(false);

  const handleDownloadImportedFile = async () => {
    setDownloadingImport(true);
    try {
      const response = await api.get('/surah-target-schedules/import/file', { responseType: 'blob' });
      const disposition = response.headers['content-disposition'] as string | undefined;
      const filename = disposition?.match(/filename="(.+)"/)?.[1] ?? 'target-schedule-import.xlsx';
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(status === 404 ? 'No file has been imported yet' : 'Failed to download imported file');
    } finally {
      setDownloadingImport(false);
    }
  };

  // ---- Delete ----
  const [deleteTarget, setDeleteTarget] = useState<TargetScheduleRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/surah-target-schedules/${deleteTarget.id}`);
      toast.success('Deleted');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['surah-target-schedules'] });
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const savingIndicator = (id: string) =>
    savingId === id && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-text-faint" />;

  const columns: ColumnDef<TargetScheduleRow, unknown>[] = [
    {
      header: 'Day',
      id: 'dayNumber',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <Input
            type="number"
            min={1}
            defaultValue={record.dayNumber}
            disabled={!canManage}
            className="w-20"
            onBlur={(e) => {
              const next = Number(e.target.value);
              if (next && next !== record.dayNumber) patchRow(record, { dayNumber: next });
            }}
          />
        );
      },
    },
    {
      header: 'Surah',
      id: 'surahId',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <Select
            className="w-[220px]"
            value={record.surahId ?? ''}
            disabled={!canManage}
            placeholder="—"
            options={surahOptions}
            onChange={(e) => patchRow(record, { surahId: e.target.value || null })}
          />
        );
      },
    },
    {
      header: 'Verse from',
      id: 'fromAyah',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <Input
            type="number"
            min={1}
            defaultValue={record.fromAyah ?? ''}
            disabled={!canManage}
            className="w-20"
            onBlur={(e) => {
              const next = e.target.value === '' ? null : Number(e.target.value);
              if (next !== record.fromAyah) patchRow(record, { fromAyah: next });
            }}
          />
        );
      },
    },
    {
      header: 'Verse to',
      id: 'toAyah',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <Input
            type="number"
            min={1}
            defaultValue={record.toAyah ?? ''}
            disabled={!canManage}
            className="w-20"
            onBlur={(e) => {
              const next = e.target.value === '' ? null : Number(e.target.value);
              if (next !== record.toAyah) patchRow(record, { toAyah: next });
            }}
          />
        );
      },
    },
    {
      header: 'Page',
      id: 'page',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              defaultValue={record.pageNumberFrom ?? ''}
              disabled={!canManage}
              className="w-[58px]"
              onBlur={(e) => {
                const next = e.target.value === '' ? null : Number(e.target.value);
                if (next !== record.pageNumberFrom) patchRow(record, { pageNumberFrom: next });
              }}
            />
            <span className="text-text-faint">-</span>
            <Input
              type="number"
              min={1}
              defaultValue={record.pageNumberTo ?? ''}
              disabled={!canManage}
              className="w-[58px]"
              onBlur={(e) => {
                const next = e.target.value === '' ? null : Number(e.target.value);
                if (next !== record.pageNumberTo) patchRow(record, { pageNumberTo: next });
              }}
            />
          </div>
        );
      },
    },
    {
      header: 'Line',
      id: 'line',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              defaultValue={record.lineFrom ?? ''}
              disabled={!canManage}
              className="w-[58px]"
              onBlur={(e) => {
                const next = e.target.value === '' ? null : Number(e.target.value);
                if (next !== record.lineFrom) patchRow(record, { lineFrom: next });
              }}
            />
            <span className="text-text-faint">-</span>
            <Input
              type="number"
              min={1}
              defaultValue={record.lineTo ?? ''}
              disabled={!canManage}
              className="w-[58px]"
              onBlur={(e) => {
                const next = e.target.value === '' ? null : Number(e.target.value);
                if (next !== record.lineTo) patchRow(record, { lineTo: next });
              }}
            />
          </div>
        );
      },
    },
    {
      header: 'Type',
      id: 'scheduleType',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <Select
            value={record.scheduleType ?? ''}
            disabled={!canManage}
            className="w-28"
            placeholder="—"
            options={[{ label: '—', value: '' }, ...SCHEDULE_TYPE_OPTIONS]}
            onChange={(e) => {
              const next = e.target.value === '' ? null : e.target.value;
              if (next !== record.scheduleType) patchRow(record, { scheduleType: next });
            }}
          />
        );
      },
    },
    {
      header: 'Exam name',
      id: 'examName',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <Input
            defaultValue={record.examName ?? ''}
            disabled={!canManage}
            className="w-32"
            onBlur={(e) => {
              const next = e.target.value === '' ? null : e.target.value;
              if (next !== record.examName) patchRow(record, { examName: next });
            }}
          />
        );
      },
    },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {savingIndicator(row.original.id)}
          {canManage && (
            <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(row.original)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-text-primary">Target Schedules</h1>
          <p className="text-sm text-text-muted">
            Day-by-day memorization pacing plan (a single master schedule), used to generate per-student Hifdh
            schedules. Edit any cell directly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownloadImportedFile} loading={downloadingImport}>
            <FileDown className="h-4 w-4" />
            Download imported file
          </Button>
          {canManage && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          width="w-56"
          label="Surah"
          placeholder="All Surahs"
          placeholderSelectable
          value={filterSurahId}
          onChange={setFilterSurahId}
          options={surahOptions}
        />
        <FilterSelect
          width="w-40"
          label="Type"
          placeholder="All types"
          placeholderSelectable
          value={filterType}
          onChange={setFilterType}
          options={typeOptions}
        />
      </div>
      <DataTable<TargetScheduleRow> columns={columns} data={rows} isLoading={list.isLoading} defaultPageSize={100} />
      <CrudFormModal
        open={modalOpen}
        title="Add Target Schedule Row"
        fields={CREATE_FIELDS}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete schedule row"
        message={`Delete day ${deleteTarget?.dayNumber}?`}
        confirmVariant="danger"
        confirmLabel="Delete"
        isLoading={deleting}
      />
      <Modal
        open={importOpen}
        title="Import Target Schedule"
        onClose={() => setImportOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={handleImport} loading={importing}>
              Import
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            Upload a spreadsheet with columns <code>day</code>, <code>surah no</code>, <code>ayah from</code>,{' '}
            <code>ayah to</code>, <code>type</code>. Importing replaces the entire existing schedule.
          </p>
          <Field label="File (.xlsx)" required>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-card border border-border bg-white px-3 py-2 text-sm text-text-primary file:mr-3 file:rounded-card file:border-0 file:bg-table-alt file:px-3 file:py-1.5 file:text-sm"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
