import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Fingerprint,
  Plus,
  RefreshCw,
  Settings2,
  UserPlus,
  Wrench,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { StatCard } from '@/components/ui/StatCard';
import { toast } from '@/components/ui/toast';
import { DeviceDetailPanel } from './DeviceDetailPanel';
import { EnrollUserModal } from './EnrollUserModal';
import { DeviceSettingsModal } from './DeviceSettingsModal';

function getErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
  return serverMessage ?? fallback;
}

export interface BiometricDevice {
  id: string;
  sn: string;
  alias: string | null;
  deviceType: string;
  deviceModel: string | null;
  ipAddress: string | null;
  fwVer: string | null;
  state: string | null;
  userCount: number | null;
  fpCount: number | null;
  faceCount: number | null;
  transactionCount: number | null;
  transferInterval: number | null;
  branchId: string | null;
  isApproved: boolean;
  deactivatedAt: string | null;
  deactivationReason: string | null;
  lastActivity: string | null;
  createdAt: string;
}

export interface DeviceStats {
  total_devices: number;
  online_devices: number;
  total_transactions_today: number;
  enrolled_users: number;
}

export interface BulkActionResult {
  success_count: number;
  failed_count: number;
  failed_devices: string[];
  message: string;
}

export function DevicesPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('devices.biometric_devices.manage');
  const queryClient = useQueryClient();
  const basePath = `/branches/${activeBranchId}/biometric-devices`;
  const devicesKey = ['biometric-devices', activeBranchId];

  const statsQuery = useQuery({
    queryKey: ['biometric-devices-stats', activeBranchId],
    queryFn: async () => (await api.get<DeviceStats>(`${basePath}/stats`)).data,
    enabled: Boolean(activeBranchId),
  });

  const devicesQuery = useQuery({
    queryKey: devicesKey,
    queryFn: async () => (await api.get<BiometricDevice[]>(basePath)).data,
    enabled: Boolean(activeBranchId),
  });

  const invalidateDevices = () => {
    queryClient.invalidateQueries({ queryKey: devicesKey });
    queryClient.invalidateQueries({ queryKey: ['biometric-devices-stats', activeBranchId] });
  };

  const [poolModalOpen, setPoolModalOpen] = useState(false);
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [detailDeviceId, setDetailDeviceId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const unassignedQuery = useQuery({
    queryKey: ['biometric-devices-unassigned'],
    queryFn: async () => (await api.get<BiometricDevice[]>('/biometric-devices/unassigned')).data,
    enabled: poolModalOpen,
  });

  const claimDevice = useMutation({
    mutationFn: async (id: string) =>
      (await api.patch(`/biometric-devices/${id}/assign`, { branchId: activeBranchId })).data,
    onSuccess: () => {
      toast.success('Device claimed for this branch');
      invalidateDevices();
      queryClient.invalidateQueries({ queryKey: ['biometric-devices-unassigned'] });
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to claim device')),
  });

  const approveDevice = useMutation({
    mutationFn: async (id: string) => (await api.patch(`/biometric-devices/${id}/approve`)).data,
    onSuccess: () => {
      toast.success('Device approved');
      invalidateDevices();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to approve device')),
  });

  const bulkAction = useMutation({
    mutationFn: async ({ action, ids }: { action: 'restart' | 'read-info'; ids: string[] }) =>
      (await api.post<BulkActionResult>(`${basePath}/bulk/${action}`, { deviceIds: ids })).data,
    onSuccess: (result) => {
      toast.success(result.message);
      invalidateDevices();
      setSelectedIds([]);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Bulk action failed')),
  });

  const devices = devicesQuery.data ?? [];
  const allSelected = devices.length > 0 && selectedIds.length === devices.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const toggleAll = (checked: boolean) => setSelectedIds(checked ? devices.map((d) => d.id) : []);
  const toggleRow = (id: string, checked: boolean) =>
    setSelectedIds((ids) => (checked ? [...ids, id] : ids.filter((i) => i !== id)));

  const columns: ColumnDef<BiometricDevice, unknown>[] = [
    ...(canManage
      ? [
          {
            id: 'select',
            header: () => (
              <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} aria-label="Select all" />
            ),
            cell: ({ row }: { row: { original: BiometricDevice } }) => (
              <Checkbox
                checked={selectedIds.includes(row.original.id)}
                onChange={(checked) => toggleRow(row.original.id, checked)}
                aria-label="Select row"
              />
            ),
          } as ColumnDef<BiometricDevice, unknown>,
        ]
      : []),
    {
      id: 'device',
      header: 'Device',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-text-primary">{row.original.alias || row.original.sn}</div>
          <div className="text-xs text-text-faint">{row.original.sn}</div>
        </div>
      ),
    },
    { id: 'model', header: 'Model', cell: ({ row }) => row.original.deviceModel ?? '-' },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={row.original.state === '1' ? 'green' : 'gray'}>
            {row.original.state === '1' ? 'Online' : 'Offline'}
          </Badge>
          {row.original.deactivatedAt ? (
            <Badge tone="red">Deactivated</Badge>
          ) : row.original.isApproved ? (
            <Badge tone="blue">Approved</Badge>
          ) : (
            <Badge tone="amber">Pending approval</Badge>
          )}
        </div>
      ),
    },
    { id: 'users', header: 'Users', cell: ({ row }) => row.original.userCount ?? '-' },
    { id: 'fp', header: 'FP', cell: ({ row }) => row.original.fpCount ?? '-' },
    { id: 'face', header: 'Face', cell: ({ row }) => row.original.faceCount ?? '-' },
    {
      id: 'lastActivity',
      header: 'Last activity',
      cell: ({ row }) => (row.original.lastActivity ? new Date(row.original.lastActivity).toLocaleString() : '-'),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {canManage && !row.original.isApproved && !row.original.deactivatedAt && (
            <Button size="sm" variant="outline" loading={approveDevice.isPending} onClick={() => approveDevice.mutate(row.original.id)}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setDetailDeviceId(row.original.id)}>
            <Wrench className="h-3.5 w-3.5" />
            Manage
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Biometric Devices"
        variant="plain"
        actions={
          canManage ? (
            <>
              {selectedIds.length > 0 && (
                <>
                  <Button variant="outline" loading={bulkAction.isPending} onClick={() => bulkAction.mutate({ action: 'restart', ids: selectedIds })}>
                    <RefreshCw className="h-4 w-4" />
                    Restart selected
                  </Button>
                  <Button variant="outline" loading={bulkAction.isPending} onClick={() => bulkAction.mutate({ action: 'read-info', ids: selectedIds })}>
                    Read info
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setSettingsModalOpen(true)}>
                <Settings2 className="h-4 w-4" />
                PIN settings
              </Button>
              <Button variant="outline" onClick={() => setEnrollModalOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Enroll user
              </Button>
              <Button onClick={() => setPoolModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Add device
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Devices" value={statsQuery.data?.total_devices ?? 0} icon={Fingerprint} isLoading={statsQuery.isLoading} />
        <StatCard title="Online" value={statsQuery.data?.online_devices ?? 0} isLoading={statsQuery.isLoading} />
        <StatCard title="Punches today" value={statsQuery.data?.total_transactions_today ?? 0} isLoading={statsQuery.isLoading} />
        <StatCard title="Enrolled users" value={statsQuery.data?.enrolled_users ?? 0} isLoading={statsQuery.isLoading} />
      </div>

      <DataTable<BiometricDevice> columns={columns} data={devices} isLoading={devicesQuery.isLoading} searchable emptyMessage="No devices assigned to this branch yet" />

      <Modal open={poolModalOpen} title="Unassigned devices" onClose={() => setPoolModalOpen(false)} width="max-w-2xl">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-muted">
            Devices register themselves the first time they contact the server. Claim one for this branch, then approve it
            to start delivering commands.
          </p>
          {unassignedQuery.isLoading ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : (unassignedQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-text-muted">No unassigned devices waiting.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border rounded-card border border-border">
              {(unassignedQuery.data ?? []).map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-text-primary">{d.alias || d.sn}</div>
                    <div className="text-xs text-text-faint">{d.sn}</div>
                  </div>
                  <Button size="sm" loading={claimDevice.isPending} onClick={() => claimDevice.mutate(d.id)}>
                    Claim for this branch
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {enrollModalOpen && (
        <EnrollUserModal
          open={enrollModalOpen}
          branchId={activeBranchId}
          devices={devices}
          onClose={() => setEnrollModalOpen(false)}
          onEnrolled={() => {
            setEnrollModalOpen(false);
            invalidateDevices();
          }}
        />
      )}

      {settingsModalOpen && (
        <DeviceSettingsModal open={settingsModalOpen} branchId={activeBranchId} onClose={() => setSettingsModalOpen(false)} />
      )}

      {detailDeviceId && (
        <DeviceDetailPanel
          deviceId={detailDeviceId}
          branchId={activeBranchId}
          canManage={canManage}
          onClose={() => setDetailDeviceId(null)}
          onChanged={invalidateDevices}
        />
      )}
    </div>
  );
}
