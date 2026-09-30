import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { Switch } from '../../components/ui/Switch';
import { Input, Field } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { toast } from '../../components/ui/toast';
import { BulkRescheduleModal } from '../academic/HifdhTrackingPage';

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

  const [browseYear, setBrowseYear] = useState<string>(String(CURRENT_YEAR));
  const [savingId, setSavingId] = useState<string | null>(null);

  // Calendar days come from the Master Calendar publish flow — branches just
  // browse by plain calendar year here, no separate per-branch generate step.
  const effectiveYear = Number(browseYear) || undefined;

  const daysQueryKey = ['calendar-days', activeBranchId, effectiveYear];
  const daysQuery = useQuery({
    queryKey: daysQueryKey,
    queryFn: async () =>
      (
        await api.get<CalendarDay[]>(`/branches/${activeBranchId}/calendar-days`, {
          params: { year: effectiveYear },
        })
      ).data,
    enabled: Boolean(activeBranchId && effectiveYear),
  });

  const statsQueryKey = ['calendar-days-stats', activeBranchId, effectiveYear];
  const statsQuery = useQuery({
    queryKey: statsQueryKey,
    queryFn: async () =>
      (
        await api.get<CalendarStats>(`/branches/${activeBranchId}/calendar-days/stats`, {
          params: { year: effectiveYear },
        })
      ).data,
    enabled: Boolean(activeBranchId && effectiveYear),
  });

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ['calendar-days'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-days-stats'] });
  };

  // ---- Reschedule prompt when marking a day Holiday/Event ----
  const [rescheduleTargets, setRescheduleTargets] = useState<{ studentId: string; studentName: string }[] | null>(
    null,
  );
  const [rescheduleFromDate, setRescheduleFromDate] = useState('');
  const [rescheduleNewStartDate, setRescheduleNewStartDate] = useState('');

  const addDays = (dateOnly: string, days: number) => {
    const d = new Date(`${dateOnly}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  /** Only call this after a day was just marked Holiday/Event true — turning either off has nothing to reschedule. */
  const checkAndPromptReschedule = async (dateOnly: string) => {
    try {
      const { data } = await api.get<{ students: { studentId: string; studentName: string }[] }>(
        `/branches/${activeBranchId}/hifdh-schedules/date-conflicts`,
        { params: { date: dateOnly } },
      );
      if (data.students.length > 0) {
        setRescheduleFromDate(dateOnly);
        setRescheduleNewStartDate(addDays(dateOnly, 1));
        setRescheduleTargets(data.students);
      }
    } catch {
      // Non-critical — the day is already marked either way; the branch can
      // still reschedule manually from Hifdh Tracking if this check fails.
    }
  };

  const patchDay = async (record: CalendarDay, payload: Partial<CalendarDay>) => {
    setSavingId(record.id);
    try {
      // Only send fields actually being changed — echoing isWorkingDay's
      // current value here would stop the backend from auto-deriving it
      // from isHoliday (see CalendarDaysService.resolveIsWorkingDay).
      await api.patch(`/branches/${activeBranchId}/calendar-days/${record.id}`, {
        ...(payload.isWorkingDay !== undefined && { isWorkingDay: payload.isWorkingDay }),
        ...(payload.isHoliday !== undefined && { isHoliday: payload.isHoliday }),
        ...(payload.holidayName !== undefined && { holidayName: payload.holidayName }),
        ...(payload.isEvent !== undefined && { isEvent: payload.isEvent }),
        ...(payload.eventName !== undefined && { eventName: payload.eventName }),
        ...(payload.note !== undefined && { note: payload.note }),
      });
      if (payload.isHoliday === true || payload.isEvent === true) {
        checkAndPromptReschedule(record.date.slice(0, 10));
      }
      refetchAll();
    } catch {
      toast.error('Failed to update day');
    } finally {
      setSavingId(null);
    }
  };

  // ---- Add ad-hoc day (single date or a date range, always for the currently active branch) ----
  const [addDayOpen, setAddDayOpen] = useState(false);
  const [addingDay, setAddingDay] = useState(false);
  const [newDayDate, setNewDayDate] = useState('');
  const [newDayToDate, setNewDayToDate] = useState('');
  const [newDayKind, setNewDayKind] = useState<'holiday' | 'event'>('holiday');
  const [newDayLabel, setNewDayLabel] = useState('');

  const openAddDay = () => {
    setNewDayDate('');
    setNewDayToDate('');
    setNewDayKind('holiday');
    setNewDayLabel('');
    setAddDayOpen(true);
  };

  const datesInRange = (from: string, to: string): string[] => {
    const dates: string[] = [];
    const cursor = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    while (cursor.getTime() <= end.getTime()) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  };

  /** Own-branch, single-day-at-a-time fallback for callers without master_calendar.manage — tries to create; if one already exists for that date, edits it in place instead. */
  const setSingleDay = async (dateStr: string, fields: Record<string, unknown>) => {
    try {
      await api.post(`/branches/${activeBranchId}/calendar-days`, { date: dateStr, ...fields });
    } catch (err) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (!serverMessage?.includes('already exists')) throw err;

      const year = Number(dateStr.slice(0, 4));
      const { data: yearDays } = await api.get<CalendarDay[]>(`/branches/${activeBranchId}/calendar-days`, {
        params: { year },
      });
      const existing = yearDays.find((d) => d.date.slice(0, 10) === dateStr);
      if (!existing) throw err;
      await api.patch(`/branches/${activeBranchId}/calendar-days/${existing.id}`, fields);
    }
  };

  /**
   * "Set Day" — works whether the date already has a row or not, so marking
   * a holiday/event never requires scrolling the table to find it first.
   * Supports a date range (loops every date from newDayDate to newDayToDate)
   * for the currently active branch only — cross-branch holidays/events are
   * set from Master Calendar's "Set Holiday" instead.
   */
  const runAddDay = async () => {
    if (!newDayDate) return;
    const toDate = newDayToDate || newDayDate;
    setAddingDay(true);
    const fields = {
      isHoliday: newDayKind === 'holiday',
      holidayName: newDayKind === 'holiday' ? newDayLabel : undefined,
      isEvent: newDayKind === 'event',
      eventName: newDayKind === 'event' ? newDayLabel : undefined,
    };
    try {
      const dates = datesInRange(newDayDate, toDate);
      for (const dateStr of dates) {
        await setSingleDay(dateStr, fields);
      }
      toast.success(dates.length > 1 ? `Set ${dates.length} days` : 'Day set');
      setAddDayOpen(false);
      setBrowseYear(newDayDate.slice(0, 4));
      if (fields.isHoliday || fields.isEvent) {
        checkAndPromptReschedule(newDayDate);
      }
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
          <Field label="Calendar year">
            <Input
              type="number"
              className="w-28"
              value={browseYear}
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
        Working days and holidays for the branch — published from the Master Calendar. Use "Set Day" to mark a date
        (or a date range, for a multi-day leave/event) as a holiday or event by picking it directly — no need to
        scroll the table to find it.
      </p>

      {effectiveYear && (
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
        width="max-w-xl"
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
            Pick a date (or a range, for a multi-day leave/event) — if a day already has a row, this edits it in
            place; otherwise it creates a new one. Either way you don't need to find it in the table yourself.
          </p>
          <div className="flex gap-3">
            <Field label="Date" required>
              <Input type="date" value={newDayDate} onChange={(e) => setNewDayDate(e.target.value)} />
            </Field>
            <Field label="To date (optional, for a range)">
              <Input
                type="date"
                value={newDayToDate}
                min={newDayDate || undefined}
                onChange={(e) => setNewDayToDate(e.target.value)}
              />
            </Field>
          </div>
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

      <BulkRescheduleModal
        activeBranchId={activeBranchId}
        students={rescheduleTargets}
        initialFromDate={rescheduleFromDate}
        initialNewStartDate={rescheduleNewStartDate}
        onClose={() => setRescheduleTargets(null)}
        onSuccess={refetchAll}
      />
    </div>
  );
}
