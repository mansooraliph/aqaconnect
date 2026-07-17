import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { DataTable } from '../../components/ui/DataTable';
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

interface TargetSchedule {
  id: string;
  surahId: string;
  name: string;
  targetsPerDay: number;
}

interface ScheduleTarget {
  id?: string;
  dayNumber: number;
  fromAyah: number;
  toAyah: number;
}

export function TargetSchedulesPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('configuration.target_schedules.manage');
  const { list, create, update } = useGlobalResource<TargetSchedule>('surah-target-schedules');

  const surahsQuery = useQuery({
    queryKey: ['surahs'],
    queryFn: async () => (await api.get<Surah[]>('/surahs')).data,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TargetSchedule | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [targetsModalOpen, setTargetsModalOpen] = useState(false);
  const [targetsSchedule, setTargetsSchedule] = useState<TargetSchedule | null>(null);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targets, setTargets] = useState<ScheduleTarget[]>([]);

  const surahOptions = (surahsQuery.data ?? []).map((s) => ({
    label: `${s.number}. ${s.nameEnglish}`,
    value: s.id,
  }));

  const surahName = (surahId: string) => {
    const surah = surahsQuery.data?.find((s) => s.id === surahId);
    return surah ? `${surah.number}. ${surah.nameEnglish}` : surahId;
  };

  const FIELDS: FieldDef[] = [
    {
      name: 'surahId',
      label: 'Surah',
      type: 'select',
      required: true,
      options: surahOptions,
    },
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'targetsPerDay', label: 'Targets per day', type: 'number', required: true },
  ];

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (record: TargetSchedule) => {
    setEditing(record);
    setModalOpen(true);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, payload: values });
        toast.success('Updated');
      } else {
        await create.mutateAsync(values);
        toast.success('Created');
      }
      setModalOpen(false);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const openTargets = async (record: TargetSchedule) => {
    setTargetsSchedule(record);
    setTargetsModalOpen(true);
    setTargetsLoading(true);
    try {
      const { data } = await api.get<ScheduleTarget[]>(`/surah-target-schedules/${record.id}/targets`);
      setTargets(
        data
          .slice()
          .sort((a, b) => a.dayNumber - b.dayNumber)
          .map((t) => ({ dayNumber: t.dayNumber, fromAyah: t.fromAyah, toAyah: t.toAyah })),
      );
    } catch {
      toast.error('Failed to load targets');
      setTargets([]);
    } finally {
      setTargetsLoading(false);
    }
  };

  const updateTargetField = (index: number, field: keyof ScheduleTarget, value: string) => {
    setTargets((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    );
  };

  const removeTargetRow = (index: number) => {
    setTargets((prev) => prev.filter((_, i) => i !== index));
  };

  const addTargetRow = () => {
    setTargets((prev) => [
      ...prev,
      { dayNumber: prev.length + 1, fromAyah: '' as unknown as number, toAyah: '' as unknown as number },
    ]);
  };

  const handleTargetsSubmit = async () => {
    if (!targetsSchedule) return;

    const isValidNumber = (v: unknown) => {
      const n = Number(v);
      return v !== '' && v !== null && v !== undefined && Number.isFinite(n) && n >= 1;
    };

    for (const t of targets) {
      if (!isValidNumber(t.dayNumber) || !isValidNumber(t.fromAyah) || !isValidNumber(t.toAyah)) {
        toast.error('Day, From ayah, and To ayah are required for every row');
        return;
      }
    }

    try {
      setTargetsLoading(true);
      const payload = targets.map((t) => ({
        dayNumber: Number(t.dayNumber),
        fromAyah: Number(t.fromAyah),
        toAyah: Number(t.toAyah),
      }));
      await api.post(`/surah-target-schedules/${targetsSchedule.id}/targets`, {
        targets: payload,
      });
      toast.success('Targets saved');
      setTargetsModalOpen(false);
    } catch {
      toast.error('Failed to save targets');
    } finally {
      setTargetsLoading(false);
    }
  };

  const columns: ColumnDef<TargetSchedule, unknown>[] = [
    {
      header: 'Surah',
      accessorKey: 'surahId',
      cell: ({ row }) => surahName(row.original.surahId),
    },
    { header: 'Name', accessorKey: 'name' },
    { header: 'Targets per day', accessorKey: 'targetsPerDay' },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openTargets(row.original)}>
            Manage targets
          </Button>
          {canManage && (
            <Button size="sm" variant="ghost" onClick={() => openEdit(row.original)}>
              <Pencil className="h-4 w-4" />
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
            Defines day-by-day memorization targets (ayah ranges) for a Surah, used to track student progress.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        )}
      </div>
      <DataTable<TargetSchedule>
        columns={columns}
        data={list.data ?? []}
        isLoading={list.isLoading}
      />
      <CrudFormModal
        open={modalOpen}
        title={editing ? 'Edit Target Schedule' : 'Add Target Schedule'}
        fields={FIELDS}
        initialValues={editing ? (editing as unknown as Record<string, unknown>) : undefined}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
      <Modal
        open={targetsModalOpen}
        title={targetsSchedule ? `Manage targets — ${targetsSchedule.name}` : 'Manage targets'}
        onClose={() => setTargetsModalOpen(false)}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setTargetsModalOpen(false)} disabled={targetsLoading}>
              Cancel
            </Button>
            <Button onClick={handleTargetsSubmit} loading={targetsLoading}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {targets.map((t, index) => (
            <div key={index} className="flex items-end gap-3">
              <div className="w-24">
                <Field label="Day" required>
                  <Input
                    type="number"
                    min={1}
                    value={t.dayNumber ?? ''}
                    onChange={(e) => updateTargetField(index, 'dayNumber', e.target.value)}
                  />
                </Field>
              </div>
              <div className="w-32">
                <Field label="From ayah" required>
                  <Input
                    type="number"
                    min={1}
                    value={t.fromAyah ?? ''}
                    onChange={(e) => updateTargetField(index, 'fromAyah', e.target.value)}
                  />
                </Field>
              </div>
              <div className="w-32">
                <Field label="To ayah" required>
                  <Input
                    type="number"
                    min={1}
                    value={t.toAyah ?? ''}
                    onChange={(e) => updateTargetField(index, 'toAyah', e.target.value)}
                  />
                </Field>
              </div>
              <Button variant="ghost" onClick={() => removeTargetRow(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addTargetRow} className="w-full justify-center">
            <Plus className="h-4 w-4" />
            Add day
          </Button>
        </div>
      </Modal>
    </div>
  );
}
