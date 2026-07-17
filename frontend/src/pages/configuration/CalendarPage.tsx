import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { FilterSelect } from '../../components/ui/FilterSelect';
import { DataTable } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { Switch } from '../../components/ui/Switch';
import { Input } from '../../components/ui/Input';
import { toast } from '../../components/ui/toast';

interface AcademicYear {
  id: string;
  name: string;
}

interface CalendarDay {
  id: string;
  date: string;
  isWorkingDay: boolean;
  isHoliday: boolean;
  note: string | null;
}

interface CalendarStats {
  totalDays: number;
  workingDays: number;
  holidays: number;
}

export function CalendarPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('configuration.calendar.manage');
  const queryClient = useQueryClient();

  const [academicYearId, setAcademicYearId] = useState<string | undefined>(undefined);
  const [savingId, setSavingId] = useState<string | null>(null);

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years', activeBranchId],
    queryFn: async () =>
      (await api.get<AcademicYear[]>(`/branches/${activeBranchId}/academic-years`)).data,
    enabled: Boolean(activeBranchId),
  });

  const daysQueryKey = ['calendar-days', activeBranchId, academicYearId];
  const daysQuery = useQuery({
    queryKey: daysQueryKey,
    queryFn: async () =>
      (
        await api.get<CalendarDay[]>(`/branches/${activeBranchId}/calendar-days`, {
          params: { academicYearId },
        })
      ).data,
    enabled: Boolean(activeBranchId && academicYearId),
  });

  const statsQueryKey = ['calendar-days-stats', activeBranchId, academicYearId];
  const statsQuery = useQuery({
    queryKey: statsQueryKey,
    queryFn: async () =>
      (
        await api.get<CalendarStats>(`/branches/${activeBranchId}/calendar-days/stats`, {
          params: { academicYearId },
        })
      ).data,
    enabled: Boolean(activeBranchId && academicYearId),
  });

  const handleGenerate = async () => {
    if (!academicYearId) return;
    const { data } = await api.post<{ created: number; skipped: number }>(
      `/branches/${activeBranchId}/calendar-days/generate`,
      { academicYearId },
    );
    toast.success(`Generated ${data.created} day(s), skipped ${data.skipped} already present`);
    daysQuery.refetch();
    statsQuery.refetch();
  };

  const patchDay = async (record: CalendarDay, payload: Partial<CalendarDay>) => {
    setSavingId(record.id);
    try {
      await api.patch(`/branches/${activeBranchId}/calendar-days/${record.id}`, {
        isWorkingDay: payload.isWorkingDay ?? record.isWorkingDay,
        isHoliday: payload.isHoliday ?? record.isHoliday,
        note: payload.note ?? record.note,
      });
      queryClient.invalidateQueries({ queryKey: daysQueryKey });
      queryClient.invalidateQueries({ queryKey: statsQueryKey });
    } catch {
      toast.error('Failed to update day');
    } finally {
      setSavingId(null);
    }
  };

  const columns: ColumnDef<CalendarDay, unknown>[] = [
    {
      header: 'Date',
      id: 'date',
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
    },
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
        <FilterSelect
          width="w-60"
          placeholder="Select academic year"
          value={academicYearId ?? ''}
          onChange={setAcademicYearId}
          options={(academicYearsQuery.data ?? []).map((y) => ({ label: y.name, value: y.id }))}
        />
      </div>

      <p className="text-sm text-text-muted">
        Working days and holidays for the branch, generated per academic year.
      </p>

      {academicYearId && (
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

          {canManage && (
            <div>
              <Button variant="outline" onClick={handleGenerate}>
                Generate calendar
              </Button>
            </div>
          )}

          <DataTable<CalendarDay>
            columns={columns}
            data={daysQuery.data ?? []}
            isLoading={daysQuery.isLoading}
          />
        </>
      )}
    </div>
  );
}
