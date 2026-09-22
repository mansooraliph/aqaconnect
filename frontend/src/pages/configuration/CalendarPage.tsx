import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { FilterSelect } from '../../components/ui/FilterSelect';
import { DataTable } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { Switch } from '../../components/ui/Switch';
import { Input, Field } from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Checkbox';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { toast } from '../../components/ui/toast';

interface AcademicYear {
  id: string;
  name: string;
}

interface CalendarDay {
  id: string;
  date: string;
  dayName: string | null;
  isWorkingDay: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  isEvent: boolean;
  eventName: string | null;
  note: string | null;
  isCustomized: boolean;
}

interface CalendarStats {
  totalDays: number;
  workingDays: number;
  holidays: number;
}

const CURRENT_YEAR = new Date().getFullYear();

export function CalendarPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('configuration.calendar.manage');
  const queryClient = useQueryClient();

  const [academicYearId, setAcademicYearId] = useState<string | undefined>(undefined);
  const [browseYear, setBrowseYear] = useState<string>(String(CURRENT_YEAR));
  const [savingId, setSavingId] = useState<string | null>(null);

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years', activeBranchId],
    queryFn: async () =>
      (await api.get<AcademicYear[]>(`/branches/${activeBranchId}/academic-years`)).data,
    enabled: Boolean(activeBranchId),
  });

  // Browsing is either by Academic Year (legacy per-academic-year `generate`
  // flow) or by plain calendar Year (the "Initiate Days" flow, which isn't
  // tied to any academic year) — Academic Year takes priority when set.
  const effectiveYear = academicYearId ? undefined : Number(browseYear) || undefined;

  const daysQueryKey = ['calendar-days', activeBranchId, academicYearId, effectiveYear];
  const daysQuery = useQuery({
    queryKey: daysQueryKey,
    queryFn: async () =>
      (
        await api.get<CalendarDay[]>(`/branches/${activeBranchId}/calendar-days`, {
          params: { academicYearId, year: effectiveYear },
        })
      ).data,
    enabled: Boolean(activeBranchId && (academicYearId || effectiveYear)),
  });

  const statsQueryKey = ['calendar-days-stats', activeBranchId, academicYearId, effectiveYear];
  const statsQuery = useQuery({
    queryKey: statsQueryKey,
    queryFn: async () =>
      (
        await api.get<CalendarStats>(`/branches/${activeBranchId}/calendar-days/stats`, {
          params: { academicYearId, year: effectiveYear },
        })
      ).data,
    enabled: Boolean(activeBranchId && (academicYearId || effectiveYear)),
  });

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ['calendar-days'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-days-stats'] });
  };

  const handleGenerate = async () => {
    if (!academicYearId) return;
    const { data } = await api.post<{ created: number; skipped: number }>(
      `/branches/${activeBranchId}/calendar-days/generate`,
      { academicYearId },
    );
    toast.success(`Generated ${data.created} day(s), skipped ${data.skipped} already present`);
    refetchAll();
  };

  const patchDay = async (record: CalendarDay, payload: Partial<CalendarDay>) => {
    setSavingId(record.id);
    try {
      await api.patch(`/branches/${activeBranchId}/calendar-days/${record.id}`, {
        isWorkingDay: payload.isWorkingDay ?? record.isWorkingDay,
        isHoliday: payload.isHoliday ?? record.isHoliday,
        holidayName: payload.holidayName ?? record.holidayName,
        isEvent: payload.isEvent ?? record.isEvent,
        eventName: payload.eventName ?? record.eventName,
        note: payload.note ?? record.note,
      });
      refetchAll();
    } catch {
      toast.error('Failed to update day');
    } finally {
      setSavingId(null);
    }
  };

  // ---- Add ad-hoc day ----
  const [addDayOpen, setAddDayOpen] = useState(false);
  const [addingDay, setAddingDay] = useState(false);
  const [newDayDate, setNewDayDate] = useState('');
  const [newDayKind, setNewDayKind] = useState<'holiday' | 'event'>('holiday');
  const [newDayLabel, setNewDayLabel] = useState('');

  const openAddDay = () => {
    setNewDayDate('');
    setNewDayKind('holiday');
    setNewDayLabel('');
    setAddDayOpen(true);
  };

  /**
   * "Set Day" — works whether the date already has a row or not, so marking
   * a holiday/event never requires scrolling the table to find it first.
   * Tries to create; if one already exists for that date, looks it up in
   * that date's year and edits it in place instead.
   */
  const runAddDay = async () => {
    if (!newDayDate) return;
    setAddingDay(true);
    const fields = {
      isHoliday: newDayKind === 'holiday',
      holidayName: newDayKind === 'holiday' ? newDayLabel : undefined,
      isEvent: newDayKind === 'event',
      eventName: newDayKind === 'event' ? newDayLabel : undefined,
    };
    try {
      try {
        await api.post(`/branches/${activeBranchId}/calendar-days`, { date: newDayDate, ...fields });
        toast.success('Day added');
      } catch (err) {
        const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        if (!serverMessage?.includes('already exists')) throw err;

        const year = Number(newDayDate.slice(0, 4));
        const { data: yearDays } = await api.get<CalendarDay[]>(`/branches/${activeBranchId}/calendar-days`, {
          params: { year },
        });
        const existing = yearDays.find((d) => d.date.slice(0, 10) === newDayDate);
        if (!existing) throw err;

        await api.patch(`/branches/${activeBranchId}/calendar-days/${existing.id}`, fields);
        toast.success('Day updated');
      }
      setAddDayOpen(false);
      setAcademicYearId(undefined);
      setBrowseYear(newDayDate.slice(0, 4));
      refetchAll();
    } catch (err) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(serverMessage ?? 'Failed to set day');
    } finally {
      setAddingDay(false);
    }
  };

  // ---- Clear year ----
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const runClearYear = async () => {
    if (!effectiveYear) return;
    setClearing(true);
    try {
      const { data } = await api.delete<{ deleted: number }>(
        `/branches/${activeBranchId}/calendar-days/year/${effectiveYear}`,
      );
      toast.success(`Deleted ${data.deleted} day(s) for ${effectiveYear}`);
      setClearOpen(false);
      refetchAll();
    } catch {
      toast.error('Failed to clear year');
    } finally {
      setClearing(false);
    }
  };

  const columns: ColumnDef<CalendarDay, unknown>[] = [
    {
      header: 'Date',
      id: 'date',
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
    },
    { header: 'Day', accessorKey: 'dayName' },
    {
      header: 'Working day',
      id: 'isWorkingDay',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={record.isWorkingDay}
              disabled={!canManage}
              onCheckedChange={(checked) => patchDay(record, { isWorkingDay: checked })}
            />
            {savingId === record.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-faint" />}
          </div>
        );
      },
    },
    {
      header: 'Holiday',
      id: 'isHoliday',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={record.isHoliday}
              disabled={!canManage}
              onCheckedChange={(checked) => patchDay(record, { isHoliday: checked })}
            />
            {savingId === record.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-faint" />}
          </div>
        );
      },
    },
    {
      header: 'Holiday name',
      id: 'holidayName',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <Input
            defaultValue={record.holidayName ?? ''}
            disabled={!canManage}
            onBlur={(e) => {
              if (e.target.value !== (record.holidayName ?? '')) {
                patchDay(record, { holidayName: e.target.value });
              }
            }}
          />
        );
      },
    },
    {
      header: 'Event',
      id: 'isEvent',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <Switch
            checked={record.isEvent}
            disabled={!canManage}
            onCheckedChange={(checked) => patchDay(record, { isEvent: checked })}
          />
        );
      },
    },
    {
      header: 'Event name',
      id: 'eventName',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <Input
            defaultValue={record.eventName ?? ''}
            disabled={!canManage}
            onBlur={(e) => {
              if (e.target.value !== (record.eventName ?? '')) {
                patchDay(record, { eventName: e.target.value });
              }
            }}
          />
        );
      },
    },
    {
      header: 'Source',
      id: 'isCustomized',
      cell: ({ row }) =>
        row.original.isCustomized ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Customized</span>
        ) : (
          <span className="rounded-full bg-table-alt px-2 py-0.5 text-xs font-medium text-text-muted">Default</span>
        ),
    },
    {
      header: 'Note',
      id: 'note',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <Input
            defaultValue={record.note ?? ''}
            disabled={!canManage}
            onBlur={(e) => {
              if (e.target.value !== (record.note ?? '')) {
                patchDay(record, { note: e.target.value });
              }
            }}
          />
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[18px] font-bold text-text-primary">Calendar</h1>
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect
            width="w-60"
            label="Academic year"
            placeholder="Browse by academic year"
            value={academicYearId ?? ''}
            onChange={(v) => setAcademicYearId(v || undefined)}
            options={(academicYearsQuery.data ?? []).map((y) => ({ label: y.name, value: y.id }))}
          />
          <Field label="Or by calendar year">
            <Input
              type="number"
              className="w-28"
              value={browseYear}
              disabled={Boolean(academicYearId)}
              onChange={(e) => setBrowseYear(e.target.value)}
            />
          </Field>
          {canManage && (
            <Button variant="outline" onClick={openAddDay}>
              <Plus className="h-4 w-4" />
              Set Day
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-text-muted">
        Working days and holidays for the branch — browse by academic year, or by a plain calendar year published from
        the Master Calendar. Use "Set Day" to mark any date as a holiday or event by picking the date directly — no
        need to scroll the table to find it.
      </p>

      {(academicYearId || effectiveYear) && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              title="Total days"
              value={statsQuery.data?.totalDays ?? 0}
              isLoading={statsQuery.isLoading}
            />
            <StatCard
              title="Working days"
              value={statsQuery.data?.workingDays ?? 0}
              isLoading={statsQuery.isLoading}
            />
            <StatCard
              title="Holidays"
              value={statsQuery.data?.holidays ?? 0}
              isLoading={statsQuery.isLoading}
            />
          </div>

          {canManage && academicYearId && (
            <div>
              <Button variant="outline" onClick={handleGenerate}>
                Generate calendar
              </Button>
            </div>
          )}

          {canManage && effectiveYear && (
            <div>
              <Button variant="danger" onClick={() => setClearOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Clear {effectiveYear}
              </Button>
            </div>
          )}

          <DataTable<CalendarDay>
            columns={columns}
            data={daysQuery.data ?? []}
            isLoading={daysQuery.isLoading}
            rowClassName={(row) => (row.isHoliday ? 'bg-red/5' : undefined)}
          />
        </>
      )}

      <ConfirmModal
        isOpen={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={runClearYear}
        title="Clear calendar year"
        message={`Permanently delete every calendar day for ${effectiveYear}? This cannot be undone.`}
        confirmVariant="danger"
        confirmLabel="Delete"
        isLoading={clearing}
      />

      <Modal
        open={addDayOpen}
        title="Set a Day"
        onClose={() => setAddDayOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setAddDayOpen(false)}>
              Cancel
            </Button>
            <Button onClick={runAddDay} disabled={!newDayDate || addingDay}>
              {addingDay ? 'Saving…' : 'Set Day'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            Pick any date — if it already has a row, this edits it in place; otherwise it creates a new branch-only
            day. Either way you don't need to find it in the table yourself.
          </p>
          <Field label="Date" required>
            <Input type="date" value={newDayDate} onChange={(e) => setNewDayDate(e.target.value)} />
          </Field>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={newDayKind === 'holiday'}
                onChange={() => setNewDayKind('holiday')}
              />
              Holiday (branch closed)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={newDayKind === 'event'} onChange={() => setNewDayKind('event')} />
              Event (attendance still taken, no lesson)
            </label>
          </div>
          <Field label={newDayKind === 'holiday' ? 'Holiday name' : 'Event name'}>
            <Input value={newDayLabel} onChange={(e) => setNewDayLabel(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
