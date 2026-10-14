import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Input';
import { toast } from '../../components/ui/toast';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';

interface TeacherGradingThresholds {
  excellentMin: number;
  goodMin: number;
  averageMin: number;
}

// API stores these as 0-1 ratios (matching getCenterPerformanceReport's own
// `ratio` variable); the UI shows 0-100 percentages. Convert at the boundary
// only, never store a percentage anywhere in state.
const toPercent = (ratio: number) => Math.round(ratio * 100);
const toRatio = (percent: number) => percent / 100;

/**
 * Global, branch-agnostic Super Admin setting: the ratio cutoffs
 * getCenterPerformanceReport's teamGradeFor uses to grade a teacher's own
 * performance (fraction of their students individually graded "Excellent").
 * Same GET/PATCH/canManage shape as BranchSettingsPage, minus the branch
 * segment — this is a single global row, not per-branch.
 */
export function TeacherGradingThresholdsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('teacher_grading_thresholds.manage');
  const queryClient = useQueryClient();
  const [goodPercent, setGoodPercent] = useState('');
  const [averagePercent, setAveragePercent] = useState('');

  const queryKey = ['teacher-grading-thresholds'];
  const thresholdsQuery = useQuery({
    queryKey,
    queryFn: async () => (await api.get<TeacherGradingThresholds>('/teacher-grading-thresholds')).data,
  });

  useEffect(() => {
    if (thresholdsQuery.data) {
      setGoodPercent(String(toPercent(thresholdsQuery.data.goodMin)));
      setAveragePercent(String(toPercent(thresholdsQuery.data.averageMin)));
    }
  }, [thresholdsQuery.data]);

  const save = useMutation({
    mutationFn: async (payload: Partial<TeacherGradingThresholds>) =>
      (await api.patch<TeacherGradingThresholds>('/teacher-grading-thresholds', payload)).data,
    onSuccess: () => {
      toast.success('Thresholds saved');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error('Failed to save thresholds'),
  });

  const handleSave = () => {
    const good = Number(goodPercent);
    const average = Number(averagePercent);

    if (!Number.isFinite(good) || good < 0 || good > 100) {
      toast.error('Good threshold must be between 0 and 100');
      return;
    }
    if (!Number.isFinite(average) || average < 0 || average > 100) {
      toast.error('Average threshold must be between 0 and 100');
      return;
    }
    if (good <= average) {
      toast.error('Good threshold must be greater than the Average threshold');
      return;
    }

    save.mutate({ goodMin: toRatio(good), averageMin: toRatio(average) });
  };

  return (
    <div className="rounded-card border border-border bg-white p-5">
      <h1 className="text-[18px] font-bold text-text-primary">Teacher Grading Thresholds</h1>
      <p className="mb-4 text-sm text-text-muted">
        The Center Performance Report grades each teacher Excellent/Good/Average/"Need to Improve" by what
        fraction of their students individually earned an "Excellent" grade. These cutoffs apply across every
        branch.
      </p>
      <div className="flex max-w-[480px] flex-col gap-4">
        <Field label="Excellent threshold (%)" hint="Fixed at 100% — by definition, every student must be graded Excellent.">
          <Input value="100" disabled />
        </Field>
        <Field label="Good threshold (%)">
          <Input
            type="number"
            min={0}
            max={100}
            value={goodPercent}
            onChange={(e) => setGoodPercent(e.target.value)}
            disabled={!canManage}
          />
        </Field>
        <Field label="Average threshold (%)">
          <Input
            type="number"
            min={0}
            max={100}
            value={averagePercent}
            onChange={(e) => setAveragePercent(e.target.value)}
            disabled={!canManage}
          />
        </Field>
        {canManage && (
          <div>
            <Button onClick={handleSave} loading={save.isPending}>
              Save
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
