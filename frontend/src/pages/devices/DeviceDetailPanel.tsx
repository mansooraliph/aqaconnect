import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { toast } from '@/components/ui/toast';
import type { BiometricDevice } from './DevicesPage';

function getErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
  return serverMessage ?? fallback;
}

interface DeviceCommand {
  id: string;
  seq: number | null;
  command: string;
  status: number;
  deviceReturnCode: number | null;
  createdAt: string;
}

const STATUS_LABEL: Record<number, { label: string; tone: 'amber' | 'green' | 'red' }> = {
  0: { label: 'Pending', tone: 'amber' },
  1: { label: 'Success', tone: 'green' },
  2: { label: 'Error', tone: 'red' },
};

interface Props {
  deviceId: string;
  branchId: string | undefined;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function DeviceDetailPanel({ deviceId, branchId, canManage, onClose, onChanged }: Props) {
  const queryClient = useQueryClient();
  const basePath = `/branches/${branchId}/biometric-devices`;
  const deviceQuery = useQuery({
    queryKey: ['biometric-device', deviceId],
    queryFn: async () => (await api.get<BiometricDevice>(`${basePath}/${deviceId}`)).data,
    enabled: Boolean(branchId),
  });
  const commandsQuery = useQuery({
    queryKey: ['biometric-device-commands', deviceId],
    queryFn: async () => (await api.get<DeviceCommand[]>(`${basePath}/${deviceId}/commands`)).data,
    enabled: Boolean(branchId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['biometric-device', deviceId] });
    queryClient.invalidateQueries({ queryKey: ['biometric-device-commands', deviceId] });
    onChanged();
  };

  const [alias, setAlias] = useState('');
  const [seconds, setSeconds] = useState('');
  const [rawCommand, setRawCommand] = useState('');
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deactivating, setDeactivating] = useState(false);

  function useDeviceAction<T>(fn: (arg: T) => Promise<unknown>, successMessage = 'Done') {
    return useMutation({
      mutationFn: fn,
      onSuccess: () => {
        toast.success(successMessage);
        refresh();
      },
      onError: (err: unknown) => toast.error(getErrorMessage(err, 'Action failed')),
    });
  }

  const renameAction = useDeviceAction<string>((value) => api.patch(`${basePath}/${deviceId}/alias`, { alias: value }), 'Renamed');
  const restartAction = useDeviceAction<void>(() => api.post(`${basePath}/${deviceId}/restart`), 'Restart queued');
  const readInfoAction = useDeviceAction<void>(() => api.post(`${basePath}/${deviceId}/read-info`), 'Info request queued');
  const duplicatePunchAction = useDeviceAction<number>(
    (value) => api.post(`${basePath}/${deviceId}/set-duplicate-punch`, { seconds: value }),
    'Duplicate-punch interval updated',
  );
  const runCommandAction = useDeviceAction<string>(
    (value) => api.post(`${basePath}/${deviceId}/command`, { command: value }),
    'Command queued',
  );
  const clearCommandsAction = useDeviceAction<void>(() => api.post(`${basePath}/${deviceId}/clear-commands`), 'Pending commands cleared');
  const clearDataAction = useDeviceAction<void>(() => api.post(`${basePath}/${deviceId}/clear-data`), 'Clear-log command queued');
  const syncUsersAction = useDeviceAction<void>(() => api.post(`${basePath}/${deviceId}/sync-users`), 'User sync queued');
  const approveAction = useDeviceAction<void>(() => api.patch(`/biometric-devices/${deviceId}/approve`), 'Device approved');
  const unassignAction = useDeviceAction<void>(() => api.patch(`/biometric-devices/${deviceId}/unassign`), 'Device unassigned');
  const reactivateAction = useDeviceAction<void>(() => api.patch(`/biometric-devices/${deviceId}/reactivate`), 'Device reactivated');
  const deactivateAction = useDeviceAction<string>(
    (reason) => api.patch(`/biometric-devices/${deviceId}/deactivate`, { reason }),
    'Device deactivated',
  );

  const device = deviceQuery.data;

  return (
    <Modal open title={device ? device.alias || device.sn : 'Device'} onClose={onClose} position="right" width="max-w-xl">
      {!device ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={device.state === '1' ? 'green' : 'gray'}>{device.state === '1' ? 'Online' : 'Offline'}</Badge>
            {device.deactivatedAt ? (
              <Badge tone="red">Deactivated</Badge>
            ) : device.isApproved ? (
              <Badge tone="blue">Approved</Badge>
            ) : (
              <Badge tone="amber">Pending approval</Badge>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-text-muted">Serial</dt>
            <dd className="text-text-primary">{device.sn}</dd>
            <dt className="text-text-muted">Model</dt>
            <dd className="text-text-primary">{device.deviceModel ?? '-'}</dd>
            <dt className="text-text-muted">Firmware</dt>
            <dd className="text-text-primary">{device.fwVer ?? '-'}</dd>
            <dt className="text-text-muted">IP address</dt>
            <dd className="text-text-primary">{device.ipAddress ?? '-'}</dd>
            <dt className="text-text-muted">Users / FP / Face</dt>
            <dd className="text-text-primary">
              {device.userCount ?? 0} / {device.fpCount ?? 0} / {device.faceCount ?? 0}
            </dd>
            <dt className="text-text-muted">Last activity</dt>
            <dd className="text-text-primary">{device.lastActivity ? new Date(device.lastActivity).toLocaleString() : '-'}</dd>
            {device.deactivationReason && (
              <>
                <dt className="text-text-muted">Deactivation reason</dt>
                <dd className="text-text-primary">{device.deactivationReason}</dd>
              </>
            )}
          </dl>

          {canManage && (
            <>
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-text-primary">Actions</h3>

                <Field label="Rename">
                  <div className="flex gap-2">
                    <Input placeholder={device.alias || device.sn} value={alias} onChange={(e) => setAlias(e.target.value)} />
                    <Button
                      variant="outline"
                      loading={renameAction.isPending}
                      onClick={() => alias.trim() && renameAction.mutate(alias.trim())}
                    >
                      Save
                    </Button>
                  </div>
                </Field>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" loading={restartAction.isPending} onClick={() => restartAction.mutate()}>
                    Restart
                  </Button>
                  <Button size="sm" variant="outline" loading={readInfoAction.isPending} onClick={() => readInfoAction.mutate()}>
                    Read info
                  </Button>
                  <Button size="sm" variant="outline" loading={syncUsersAction.isPending} onClick={() => syncUsersAction.mutate()}>
                    Sync users
                  </Button>
                  <Button size="sm" variant="outline" loading={clearDataAction.isPending} onClick={() => clearDataAction.mutate()}>
                    Clear device logs
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={clearCommandsAction.isPending}
                    onClick={() => clearCommandsAction.mutate()}
                  >
                    Clear pending commands
                  </Button>
                  {!device.isApproved && !device.deactivatedAt && (
                    <Button size="sm" loading={approveAction.isPending} onClick={() => approveAction.mutate()}>
                      Approve
                    </Button>
                  )}
                  {device.deactivatedAt ? (
                    <Button size="sm" variant="outline" loading={reactivateAction.isPending} onClick={() => reactivateAction.mutate()}>
                      Reactivate
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setDeactivating(true)}>
                      Deactivate…
                    </Button>
                  )}
                  <Button size="sm" variant="outline" loading={unassignAction.isPending} onClick={() => unassignAction.mutate()}>
                    Unassign
                  </Button>
                </div>

                {deactivating && (
                  <Field label="Deactivation reason" hint="Required">
                    <div className="flex gap-2">
                      <Input value={deactivateReason} onChange={(e) => setDeactivateReason(e.target.value)} />
                      <Button
                        variant="danger"
                        loading={deactivateAction.isPending}
                        onClick={() => {
                          if (!deactivateReason.trim()) return;
                          deactivateAction.mutate(deactivateReason.trim());
                          setDeactivating(false);
                          setDeactivateReason('');
                        }}
                      >
                        Confirm
                      </Button>
                    </div>
                  </Field>
                )}

                <Field label="Duplicate-punch interval (seconds)">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={3600}
                      placeholder={device.transferInterval != null ? String(device.transferInterval) : '0'}
                      value={seconds}
                      onChange={(e) => setSeconds(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      loading={duplicatePunchAction.isPending}
                      onClick={() => seconds !== '' && duplicatePunchAction.mutate(Number(seconds))}
                    >
                      Set
                    </Button>
                  </div>
                </Field>

                <Field label="Run raw command" hint="Use \t for tab separators, e.g. DATA USER PIN=S101\tName=John">
                  <div className="flex flex-col gap-2">
                    <Textarea rows={2} value={rawCommand} onChange={(e) => setRawCommand(e.target.value)} />
                    <Button
                      variant="outline"
                      loading={runCommandAction.isPending}
                      onClick={() => rawCommand.trim() && runCommandAction.mutate(rawCommand.trim())}
                    >
                      Queue command
                    </Button>
                  </div>
                </Field>
              </div>
            </>
          )}

          <div className="border-t border-border pt-4">
            <h3 className="mb-2 text-sm font-semibold text-text-primary">Recent commands</h3>
            {commandsQuery.isLoading ? (
              <p className="text-sm text-text-muted">Loading…</p>
            ) : (commandsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-text-muted">No commands yet.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border rounded-card border border-border">
                {(commandsQuery.data ?? []).map((c) => {
                  const status = STATUS_LABEL[c.status] ?? { label: String(c.status), tone: 'amber' as const };
                  return (
                    <div key={c.id} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-text-primary">{c.command}</div>
                        <div className="text-text-faint">{new Date(c.createdAt).toLocaleString()}</div>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
