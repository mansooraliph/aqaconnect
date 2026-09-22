import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarDays, CalendarPlus, Loader2, Sun, Trash2, UploadCloud } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useBranches } from '../../hooks/useBranches';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { Switch } from '../../components/ui/Switch';
import { Input, Field } from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Checkbox';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { toast } from '../../components/ui/toast';

interface MasterCalendarDay {
  id: string;
  date: string;
  dayName: string | null;
  isWorkingDay: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  isEvent: boolean;
  eventName: string | null;
  note: string | null;
}

interface MasterCalendarStats {
  totalDays: number;
  workingDays: number;
  holidays: number;
  events: number;
}

interface PublishSummary {
  year: number;
  branches: { branchId: string; created: number; updated: number; skipped: number }[];
}

const WEEKDAYS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'sunday', label: 'Sunday', icon: Sun },
  { key: 'monday', label: 'Monday', icon: CalendarDays },
  { key: 'tuesday', label: 'Tuesday', icon: CalendarDays },
  { key: 'wednesday', label: 'Wednesday', icon: CalendarDays },
  { key: 'thursday', label: 'Thursday', icon: CalendarDays },
  { key: 'friday', label: 'Friday', icon: CalendarDays },
  { key: 'saturday', label: 'Saturday', icon: Sun },
];

const WEEKEND_PATTERNS = [
  { key: '1st', label: 'First Saturday & Sunday' },
  { key: '2nd', label: 'Second Saturday & Sunday' },
  { key: '3rd', label: 'Third Saturday & Sunday' },
  { key: '4th', label: 'Fourth Saturday & Sunday' },
  { key: 'last', label: 'Last Saturday & Sunday (if 5th week exists)' },
];

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Super Admin's single, branch-less common calendar (see MasterCalendarService
 * on the backend). Publishing a year copies matching days into every target
 * branch's own Calendar — a branch day it has already customized is never
 * overwritten. Mirrors CalendarPage.tsx's "Initiate Days" wizard, plus an
 * Event toggle (attendance still happens, no lesson scheduled) and Publish.
 */
export function MasterCalendarPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('master_calendar.manage');
  const queryClient = useQueryClient();
  const branchesQuery = useBranches();

  const [browseYear, setBrowseYear] = useState<string>(String(CURRENT_YEAR));
  const [savingId, setSavingId] = useState<string | null>(null);
  const year = Number(browseYear) || undefined;

  const daysQueryKey = ['master-calendar-days', year];
  const daysQuery = useQuery({
    queryKey: daysQueryKey,
    queryFn: async () => (await api.get<MasterCalendarDay[]>('/master-calendar', { params: { year } })).data,
    enabled: Boolean(year),
  });

  const statsQueryKey = ['master-calendar-stats', year];
  const statsQuery = useQuery({
    queryKey: statsQueryKey,
    queryFn: async () => (await api.get<MasterCalendarStats>('/master-calendar/stats', { params: { year } })).data,
    enabled: Boolean(year),
  });

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ['master-calendar-days'] });
    queryClient.invalidateQueries({ queryKey: ['master-calendar-stats'] });
  };

  const patchDay = async (record: MasterCalendarDay, payload: Partial<MasterCalendarDay>) => {
    setSavingId(record.id);
    try {
      await api.patch(`/master-calendar/${record.id}`, {
        isWorkingDay: payload.isWorkingDay ?? record.isWorkingDay,
        isHoliday: payload.isHoliday ?? record.isHoliday,
        isEvent: payload.isEvent ?? record.isEvent,
        note: payload.note ?? record.note,
      });
      refetchAll();
    } catch {
      toast.error('Failed to update day');
    } finally {
      setSavingId(null);
    }
  };

  // ---- Initiate Days ----
  const [initiateOpen, setInitiateOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [initYear, setInitYear] = useState(String(CURRENT_YEAR));
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>([]);
  const [weekendOption, setWeekendOption] = useState<'all' | 'specific'>('all');
  const [selectedWeekends, setSelectedWeekends] = useState<string[]>([]);
  const [holidayName, setHolidayName] = useState('Weekly Holiday');
  const [includeIslamicHolidays, setIncludeIslamicHolidays] = useState(true);

  const bothWeekendDaysSelected = selectedWeekdays.includes('saturday') && selectedWeekdays.includes('sunday');

  const toggleWeekday = (key: string) => {
    setSelectedWeekdays((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]));
  };
  const toggleWeekend = (key: string) => {
    setSelectedWeekends((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]));
  };

  const openInitiate = () => {
    // Default to whatever year is currently browsed at the top of the page,
    // not always the real-world current year — otherwise changing the
    // "Calendar year" field first and then clicking Initiate Days silently
    // generates for the wrong year.
    setInitYear(browseYear || String(CURRENT_YEAR));
    setSelectedWeekdays([]);
    setWeekendOption('all');
    setSelectedWeekends([]);
    setHolidayName('Weekly Holiday');
    setIncludeIslamicHolidays(true);
    setInitiateOpen(true);
  };

  const runInitiateDays = async () => {
    setInitiating(true);
    try {
      const { data } = await api.post<{ generatedDays: number; updatedHolidays: number }>(
        '/master-calendar/initiate-days',
        { year: Number(initYear), selectedWeekdays, weekendOption, selectedWeekends, holidayName, includeIslamicHolidays },
      );
      toast.success(
        `Generated ${data.generatedDays} day(s) for ${initYear}` +
          (data.updatedHolidays > 0 ? ` and marked ${data.updatedHolidays} holiday(s)` : ''),
      );
      setConfirmOpen(false);
      setInitiateOpen(false);
      setBrowseYear(initYear);
      refetchAll();
    } catch {
      toast.error('Failed to initiate days');
    } finally {
      setInitiating(false);
    }
  };

  const confirmMessage = useMemo(() => {
    const parts = [`Generate all master-calendar days for year ${initYear}?`];
    if (selectedWeekdays.length > 0) parts.push(`${selectedWeekdays.length} weekday(s) will be marked as holidays.`);
    if (includeIslamicHolidays) parts.push('Islamic holidays will be included.');
    return parts.join(' ');
  }, [initYear, selectedWeekdays, includeIslamicHolidays]);

  // ---- Clear year ----
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const runClearYear = async () => {
    if (!year) return;
    setClearing(true);
    try {
      const { data } = await api.delete<{ deleted: number }>(`/master-calendar/year/${year}`);
      toast.success(`Deleted ${data.deleted} day(s) for ${year}`);
      setClearOpen(false);
      refetchAll();
    } catch {
      toast.error('Failed to clear year');
    } finally {
      setClearing(false);
    }
  };

  // ---- Publish to branches ----
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [publishSummary, setPublishSummary] = useState<PublishSummary | null>(null);

  const openPublish = () => {
    setSelectedBranchIds((branchesQuery.data ?? []).filter((b) => b.isActive).map((b) => b.id));
    setPublishSummary(null);
    setPublishOpen(true);
  };

  const toggleBranch = (id: string) => {
    setSelectedBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  const runPublish = async () => {
    if (!year) return;
    setPublishing(true);
    try {
      const { data } = await api.post<PublishSummary>('/master-calendar/publish', {
        year,
        branchIds: selectedBranchIds,
      });
      setPublishSummary(data);
      const totals = data.branches.reduce(
        (acc, b) => ({ created: acc.created + b.created, updated: acc.updated + b.updated, skipped: acc.skipped + b.skipped }),
        { created: 0, updated: 0, skipped: 0 },
      );
      toast.success(
        `Published to ${data.branches.length} branch(es): ${totals.created} created, ${totals.updated} synced, ${totals.skipped} kept as customized`,
      );
    } catch {
      toast.error('Failed to publish master calendar');
    } finally {
      setPublishing(false);
    }
  };

  const columns: ColumnDef<MasterCalendarDay, unknown>[] = [
    { header: 'Date', id: 'date', cell: ({ row }) => new Date(row.original.date).toLocaleDateString() },
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
          <Switch
            checked={record.isHoliday}
            disabled={!canManage}
            onCheckedChange={(checked) => patchDay(record, { isHoliday: checked })}
          />
        );
      },
    },
    { header: 'Holiday name', accessorKey: 'holidayName' },
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
    { header: 'Event name', accessorKey: 'eventName' },
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
              if (e.target.value !== (record.note ?? '')) patchDay(record, { note: e.target.value });
            }}
          />
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[18px] font-bold text-text-primary">Master Calendar</h1>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Calendar year">
            <Input type="number" className="w-28" value={browseYear} onChange={(e) => setBrowseYear(e.target.value)} />
          </Field>
          {canManage && (
            <Button onClick={openInitiate}>
              <CalendarPlus className="h-4 w-4" />
              Initiate Days
            </Button>
          )}
          {canManage && (
            <Button variant="outline" onClick={openPublish} disabled={!year}>
              <UploadCloud className="h-4 w-4" />
              Publish to Branches
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-text-muted">
        The common calendar you maintain once and publish to every branch. A branch day it has already customized is
        never overwritten by a publish — only days the branch hasn't touched get filled in or synced.
      </p>

      {year && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard title="Total days" value={statsQuery.data?.totalDays ?? 0} isLoading={statsQuery.isLoading} />
            <StatCard title="Working days" value={statsQuery.data?.workingDays ?? 0} isLoading={statsQuery.isLoading} />
            <StatCard title="Holidays" value={statsQuery.data?.holidays ?? 0} isLoading={statsQuery.isLoading} />
            <StatCard title="Events" value={statsQuery.data?.events ?? 0} isLoading={statsQuery.isLoading} />
          </div>

          {canManage && (
            <div>
              <Button variant="danger" onClick={() => setClearOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Clear {year}
              </Button>
            </div>
          )}

          <DataTable<MasterCalendarDay>
            columns={columns}
            data={daysQuery.data ?? []}
            isLoading={daysQuery.isLoading}
            rowClassName={(row) => (row.isHoliday ? 'bg-red/5' : row.isEvent ? 'bg-blue-light' : undefined)}
          />
        </>
      )}

      <Modal
        open={initiateOpen}
        title="Initiate Master Calendar Days"
        onClose={() => setInitiateOpen(false)}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setInitiateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setConfirmOpen(true)}>Generate Days</Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <Field label="Select year" required>
            <Input type="number" value={initYear} onChange={(e) => setInitYear(e.target.value)} />
          </Field>

          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">Select weekdays to mark as holidays</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {WEEKDAYS.map((w) => (
                <label key={w.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selectedWeekdays.includes(w.key)} onChange={() => toggleWeekday(w.key)} />
                  <w.icon className="h-4 w-4 text-text-faint" />
                  {w.label}
                </label>
              ))}
            </div>
          </div>

          {bothWeekendDaysSelected && (
            <div className="rounded-card border border-border p-4">
              <p className="mb-2 text-sm font-medium text-text-primary">Weekend holiday options</p>
              <label className="mb-2 flex items-start gap-2 text-sm">
                <input type="radio" className="mt-1" checked={weekendOption === 'all'} onChange={() => setWeekendOption('all')} />
                <span>
                  <strong>All Saturdays &amp; Sundays</strong>
                  <span className="block text-xs text-text-muted">Mark every Saturday and Sunday as holiday</span>
                </span>
              </label>
              <label className="mb-2 flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  className="mt-1"
                  checked={weekendOption === 'specific'}
                  onChange={() => setWeekendOption('specific')}
                />
                <span>
                  <strong>Specific weekends only</strong>
                  <span className="block text-xs text-text-muted">Select which Saturday-Sunday combinations</span>
                </span>
              </label>
              {weekendOption === 'specific' && (
                <div className="ml-6 mt-2 flex flex-col gap-1.5">
                  {WEEKEND_PATTERNS.map((w) => (
                    <label key={w.key} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={selectedWeekends.includes(w.key)} onChange={() => toggleWeekend(w.key)} />
                      {w.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedWeekdays.length > 0 && (
            <Field label="Holiday name">
              <Input value={holidayName} onChange={(e) => setHolidayName(e.target.value)} />
            </Field>
          )}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeIslamicHolidays} onChange={setIncludeIslamicHolidays} />
            <span>
              <strong>Include Islamic Holidays</strong>
              <span className="block text-xs text-text-muted">
                Automatically add Ramadan, Eid ul-Fitr, and Eid ul-Adha (Bakrid) holidays
              </span>
            </span>
          </label>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={runInitiateDays}
        title="Confirm Generation"
        message={confirmMessage}
        confirmLabel="Yes, Generate!"
        isLoading={initiating}
      />

      <ConfirmModal
        isOpen={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={runClearYear}
        title="Clear master calendar year"
        message={`Permanently delete every master calendar day for ${year}? This does not affect any branch's own calendar. This cannot be undone.`}
        confirmVariant="danger"
        confirmLabel="Delete"
        isLoading={clearing}
      />

      <Modal
        open={publishOpen}
        title={`Publish ${year ?? ''} to Branches`}
        onClose={() => setPublishOpen(false)}
        width="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Close
            </Button>
            <Button onClick={runPublish} disabled={selectedBranchIds.length === 0 || publishing}>
              {publishing ? 'Publishing…' : `Publish to ${selectedBranchIds.length} branch(es)`}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-card border border-blue/30 bg-blue-light p-4 text-sm text-blue">
            A branch day it has already customized (edited, or added on its own) is left untouched. Only days the
            branch hasn't touched get created or synced from the master.
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">Branches</p>
            <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
              {(branchesQuery.data ?? []).map((branch) => (
                <label key={branch.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selectedBranchIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} />
                  {branch.name}
                </label>
              ))}
            </div>
          </div>

          {publishSummary && (
            <div className="rounded-card border border-border p-3 text-xs text-text-muted">
              <p className="mb-1 font-medium text-text-primary">Result</p>
              {publishSummary.branches.map((b) => (
                <p key={b.branchId}>
                  {b.branchId}: {b.created} created, {b.updated} synced, {b.skipped} kept as customized
                </p>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
