import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/toast';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';

interface AcademicYear {
  id: string;
  name: string;
}

interface BranchSettings {
  displayName: string | null;
  currency: string | null;
  timezone: string | null;
  language: string | null;
  logoUrl: string | null;
  academicYearId: string | null;
}

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'PKR', 'INR'].map((c) => ({
  label: c,
  value: c,
}));

export function BranchSettingsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('configuration.branch_settings.manage');
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, unknown>>({});

  const settingsQueryKey = ['branch-settings', activeBranchId];
  const settingsQuery = useQuery({
    queryKey: settingsQueryKey,
    queryFn: async () => (await api.get<BranchSettings>(`/branches/${activeBranchId}/settings`)).data,
    enabled: Boolean(activeBranchId),
  });

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years', activeBranchId],
    queryFn: async () =>
      (await api.get<AcademicYear[]>(`/branches/${activeBranchId}/academic-years`)).data,
    enabled: Boolean(activeBranchId),
  });

  useEffect(() => {
    if (settingsQuery.data) {
      // Only the editable fields — the GET response also carries id/branchId/
      // createdAt/updatedAt, which UpdateBranchSettingsDto rejects
      // (forbidNonWhitelisted) if they're echoed back on save.
      const { displayName, currency, timezone, language, logoUrl, academicYearId } = settingsQuery.data;
      setValues({ displayName, currency, timezone, language, logoUrl, academicYearId });
    }
  }, [settingsQuery.data]);

  const save = useMutation({
    mutationFn: async (payload: Partial<BranchSettings>) =>
      (await api.patch<BranchSettings>(`/branches/${activeBranchId}/settings`, payload)).data,
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: settingsQueryKey });
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const setField = (name: string, value: unknown) => {
    setValues((v) => ({ ...v, [name]: value }));
  };

  const handleFinish = () => {
    save.mutate(values);
  };

  return (
    <div className="rounded-card border border-border bg-white p-5">
      <h1 className="text-[18px] font-bold text-text-primary">Branch Settings</h1>
      <p className="mb-4 text-sm text-text-muted">
        Branch-wide display and localization settings.
      </p>
      <div className="flex max-w-[480px] flex-col gap-4">
        <Field label="Display name">
          <Input
            value={(values.displayName as string) ?? ''}
            onChange={(e) => setField('displayName', e.target.value)}
            disabled={!canManage}
          />
        </Field>
        <Field label="Currency">
          <Select
            options={CURRENCY_OPTIONS}
            value={(values.currency as string) ?? ''}
            onChange={(e) => setField('currency', e.target.value)}
            disabled={!canManage}
          />
        </Field>
        <Field label="Timezone">
          <Input
            value={(values.timezone as string) ?? ''}
            onChange={(e) => setField('timezone', e.target.value)}
            disabled={!canManage}
          />
        </Field>
        <Field label="Language">
          <Input
            value={(values.language as string) ?? ''}
            onChange={(e) => setField('language', e.target.value)}
            disabled={!canManage}
          />
        </Field>
        <Field label="Logo URL">
          <Input
            value={(values.logoUrl as string) ?? ''}
            onChange={(e) => setField('logoUrl', e.target.value)}
            disabled={!canManage}
          />
        </Field>
        <Field label="Academic year">
          <Select
            options={[
              { label: '— None —', value: '' },
              ...(academicYearsQuery.data ?? []).map((y) => ({ label: y.name, value: y.id })),
            ]}
            value={(values.academicYearId as string) ?? ''}
            onChange={(e) => setField('academicYearId', e.target.value)}
            disabled={!canManage}
          />
        </Field>
        {canManage && (
          <div>
            <Button onClick={handleFinish} loading={save.isPending}>
              Save
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
