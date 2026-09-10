import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/toast';
import type { BiometricDevice } from './DevicesPage';

function getErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
  return serverMessage ?? fallback;
}

type EnrollUserType = 'student' | 'teacher' | 'staff';
type BiometricType = 'fingerprint' | 'face' | 'palm';

interface EnrollableUser {
  id: string;
  userType: EnrollUserType;
  code: string;
  userCode: string;
  name: string;
  subtitle?: string;
  enrollmentStatus: 'enrolled' | 'pending' | 'none';
}

interface Props {
  open: boolean;
  branchId: string | undefined;
  devices: BiometricDevice[];
  onClose: () => void;
  onEnrolled: () => void;
}

export function EnrollUserModal({ open, branchId, devices, onClose, onEnrolled }: Props) {
  const basePath = `/branches/${branchId}/biometric-devices`;
  const [userType, setUserType] = useState<EnrollUserType>('student');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<EnrollableUser | null>(null);
  const [biometricType, setBiometricType] = useState<BiometricType>('fingerprint');
  const [fingerId, setFingerId] = useState('6');
  const [deviceIds, setDeviceIds] = useState<string[]>([]);

  const usersQuery = useQuery({
    queryKey: ['biometric-enroll-users', branchId, userType, search],
    queryFn: async () =>
      (await api.get<EnrollableUser[]>(`${basePath}/enroll/users`, { params: { type: userType, search: search || undefined } })).data,
    enabled: Boolean(branchId),
  });

  const enroll = useMutation({
    mutationFn: async () =>
      (
        await api.post(`${basePath}/enrollments`, {
          userType,
          userId: selectedUser?.id,
          biometricType,
          fingerId: biometricType === 'fingerprint' ? Number(fingerId) : undefined,
          deviceIds,
        })
      ).data,
    onSuccess: (result: { message?: string }) => {
      toast.success(result?.message ?? 'Enrollment queued');
      onEnrolled();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to queue enrollment')),
  });

  const toggleDevice = (id: string, checked: boolean) =>
    setDeviceIds((ids) => (checked ? [...ids, id] : ids.filter((i) => i !== id)));

  const canSubmit = Boolean(selectedUser) && deviceIds.length > 0;

  return (
    <Modal
      open={open}
      title="Enroll user"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} loading={enroll.isPending} onClick={() => enroll.mutate()}>
            Queue enrollment
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="User type">
          <Select
            options={[
              { label: 'Student', value: 'student' },
              { label: 'Teacher', value: 'teacher' },
              { label: 'Staff', value: 'staff' },
            ]}
            value={userType}
            onChange={(e) => {
              setUserType(e.target.value as EnrollUserType);
              setSelectedUser(null);
            }}
          />
        </Field>

        <Field label="Search">
          <Input
            value={search}
            placeholder="Name or code…"
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedUser(null);
            }}
          />
        </Field>

        <div className="max-h-48 overflow-y-auto rounded-card border border-border">
          {usersQuery.isLoading ? (
            <p className="p-3 text-sm text-text-muted">Loading…</p>
          ) : (usersQuery.data ?? []).length === 0 ? (
            <p className="p-3 text-sm text-text-muted">No matches.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {(usersQuery.data ?? []).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUser(u)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-table-alt ${
                    selectedUser?.id === u.id ? 'bg-table-alt' : ''
                  }`}
                >
                  <div>
                    <div className="text-text-primary">{u.name}</div>
                    <div className="text-xs text-text-faint">{u.userCode}</div>
                  </div>
                  {u.enrollmentStatus !== 'none' && (
                    <Badge tone={u.enrollmentStatus === 'enrolled' ? 'green' : 'amber'}>{u.enrollmentStatus}</Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <Field label="Biometric type">
          <Select
            options={[
              { label: 'Fingerprint', value: 'fingerprint' },
              { label: 'Face', value: 'face' },
              { label: 'Palm', value: 'palm' },
            ]}
            value={biometricType}
            onChange={(e) => setBiometricType(e.target.value as BiometricType)}
          />
        </Field>

        {biometricType === 'fingerprint' && (
          <Field label="Finger" hint="0-9, default 6 = left index">
            <Input type="number" min={0} max={9} value={fingerId} onChange={(e) => setFingerId(e.target.value)} />
          </Field>
        )}

        <Field label="Devices">
          <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-card border border-border p-3">
            {devices.length === 0 ? (
              <p className="text-sm text-text-muted">No devices in this branch yet.</p>
            ) : (
              devices.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={deviceIds.includes(d.id)} onChange={(checked) => toggleDevice(d.id, checked)} />
                  {d.alias || d.sn}
                </label>
              ))
            )}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
