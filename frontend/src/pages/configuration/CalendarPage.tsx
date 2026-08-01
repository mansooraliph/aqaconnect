import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarDays, CalendarPlus, Loader2, Sun, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
  note: string | null;
}

interface CalendarStats {
  totalDays: number;
  workingDays: number;
  holidays: number;
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
    setInitYear(String(CURRENT_YEAR));
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
        `/branches/${activeBranchId}/calendar-days/initiate-days`,
        {
          year: Number(initYear),
          selectedWeekdays,
          weekendOption,
          selectedWeekends,
          holidayName,
          includeIslamicHolidays,
        },
      );
      toast.success(
        `Generated ${data.generatedDays} day(s) for ${initYear}` +
          (data.updatedHolidays > 0 ? ` and marked ${data.updatedHolidays} holiday(s)` : ''),
      );
      setConfirmOpen(false);
      setInitiateOpen(false);
      setBrowseYear(initYear);
      setAcademicYearId(undefined);
      refetchAll();
    } catch {
      toast.error('Failed to initiate days');
    } finally {
      setInitiating(false);
    }
  };

  const confirmMessage = useMemo(() => {
    const parts = [`Generate all days for year ${initYear}?`];
    if (selectedWeekdays.length > 0) parts.push(`${selectedWeekdays.length} weekday(s) will be marked as holidays.`);
    if (includeIslamicHolidays) parts.push('Islamic holidays will be included.');
    return parts.join(' ');
  }, [initYear, selectedWeekdays, includeIslamicHolidays]);

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
    { header: 'Holiday name', accessorKey: 'holidayName' },
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
            <Button onClick={openInitiate}>
              <CalendarPlus className="h-4 w-4" />
              Initiate Days
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-text-muted">
        Working days and holidays for the branch — browse by academic year, or by a plain calendar year generated via
        "Initiate Days".
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

      <Modal
        open={initiateOpen}
        title="Initiate Days for Year"
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
                  <Checkbox
                    checked={selectedWeekdays.includes(w.key)}
                    onChange={() => toggleWeekday(w.key)}
                  />
                  <w.icon className="h-4 w-4 text-text-faint" />
                  {w.label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-text-faint">Check the days you want to mark as weekly holidays.</p>
          </div>

          {bothWeekendDaysSelected && (
            <div className="rounded-card border border-border p-4">
              <p className="mb-2 text-sm font-medium text-text-primary">Weekend holiday options</p>
              <label className="mb-2 flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  className="mt-1"
                  checked={weekendOption === 'all'}
                  onChange={() => setWeekendOption('all')}
                />
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
                      <Checkbox
                        checked={selectedWeekends.includes(w.key)}
                        onChange={() => toggleWeekend(w.key)}
                      />
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

          <div className="rounded-card border border-blue/30 bg-blue-light p-4 text-sm text-blue">
            <p className="mb-1 font-medium">What will happen?</p>
            <ul className="list-disc pl-4">
              <li>All days for the selected year will be generated</li>
              <li>Selected weekdays will be marked as holidays throughout the year</li>
              <li>Existing days will not be duplicated</li>
            </ul>
          </div>
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
        title="Clear calendar year"
        message={`Permanently delete every calendar day for ${effectiveYear}? This cannot be undone.`}
        confirmVariant="danger"
        confirmLabel="Delete"
        isLoading={clearing}
      />
    </div>
  );
}
