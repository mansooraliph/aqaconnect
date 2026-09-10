import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { toast } from '@/components/ui/toast';

function getErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
  return serverMessage ?? fallback;
}

interface Prefixes {
  STUDENT: string | null;
  TEACHER: string | null;
  STAFF: string | null;
}

interface Props {
  open: boolean;
  branchId: string | undefined;
  onClose: () => void;
}

export function DeviceSettingsModal({ open, branchId, onClose }: Props) {
  const basePath = `/branches/${branchId}/biometric-devices`;
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ['biometric-devices-settings', branchId],
    queryFn: async () => (await api.get<{ prefixes: Prefixes }>(`${basePath}/settings`)).data.prefixes,
    enabled: Boolean(branchId),
  });

  const [prefixes, setPrefixes] = useState<Prefixes>({ STUDENT: 'S', TEACHER: 'T', STAFF: 'E' });

  useEffect(() => {
    if (settingsQuery.data) setPrefixes(settingsQuery.data);
  }, [settingsQuery.data]);

  const save = useMutation({
    mutationFn: async () => (await api.put(`${basePath}/settings`, { prefixes })).data,
    onSuccess: () => {
      toast.success('PIN prefixes updated');
      queryClient.invalidateQueries({ queryKey: ['biometric-devices-settings', branchId] });
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update settings')),
  });

  return (
    <Modal
      open={open}
      title="Device PIN prefixes"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          Each enrolled user gets a device PIN of <code>prefix + code</code>. Leave a prefix blank to use the raw code with
          no prefix for that type — not recommended if types can share the same code.
        </p>
        <Field label="Student prefix">
          <Input
            value={prefixes.STUDENT ?? ''}
            onChange={(e) => setPrefixes((p) => ({ ...p, STUDENT: e.target.value || null }))}
          />
        </Field>
        <Field label="Teacher prefix">
          <Input
            value={prefixes.TEACHER ?? ''}
            onChange={(e) => setPrefixes((p) => ({ ...p, TEACHER: e.target.value || null }))}
          />
        </Field>
        <Field label="Staff prefix">
          <Input value={prefixes.STAFF ?? ''} onChange={(e) => setPrefixes((p) => ({ ...p, STAFF: e.target.value || null }))} />
        </Field>
      </div>
    </Modal>
  );
}
