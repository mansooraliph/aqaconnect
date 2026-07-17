import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Copy, Plus } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { CrudFormModal, type FieldDef } from '../../components/CrudFormModal';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { Field, Input, Textarea } from '../../components/ui/Input';
import { toast } from '../../components/ui/toast';

type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface TeacherApplication {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  resumeUrl: string | null;
  coverNote: string | null;
  status: ApplicationStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
}

const applicationFields: FieldDef[] = [
  { name: 'fullName', label: 'Full name', type: 'text', required: true },
  { name: 'email', label: 'Email', type: 'text', required: true },
  { name: 'phone', label: 'Phone', type: 'text' },
  { name: 'resumeUrl', label: 'Resume URL', type: 'text' },
  { name: 'coverNote', label: 'Cover note', type: 'textarea' },
];

export function TeacherApplicationsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('hr.teacher_applications.manage');

  const { list, create, basePath } = useBranchResource<TeacherApplication>(
    activeBranchId,
    'teacher-applications',
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [actionTarget, setActionTarget] = useState<TeacherApplication | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [credentials, setCredentials] = useState<{
    teacherId: string;
    temporaryPassword: string;
    note: string;
  } | null>(null);

  const handleCreate = async (values: Record<string, unknown>) => {
    setCreating(true);
    try {
      await create.mutateAsync(values);
      toast.success('Application created');
      setCreateOpen(false);
    } catch {
      toast.error('Failed to create application');
    } finally {
      setCreating(false);
    }
  };

  const openAction = (record: TeacherApplication, type: 'approve' | 'reject') => {
    setActionTarget(record);
    setActionType(type);
    setActionNote('');
    setActionError(null);
  };

  const closeAction = () => {
    setActionTarget(null);
    setActionType(null);
    setActionNote('');
    setActionError(null);
  };

  const submitAction = async () => {
    if (!actionTarget || !actionType) return;
    if (actionType === 'reject' && !actionNote.trim()) {
      setActionError('A review note is required to reject an application');
      return;
    }
    setActionError(null);
    setActionLoading(true);
    try {
      if (actionType === 'approve') {
        const { data } = await api.post<{
          teacherId: string;
          temporaryPassword: string;
          note: string;
        }>(`${basePath}/${actionTarget.id}/approve`, {
          reviewNote: actionNote || undefined,
        });
        setCredentials(data);
        toast.success('Application approved');
      } else {
        await api.post(`${basePath}/${actionTarget.id}/reject`, { reviewNote: actionNote });
        toast.success('Application rejected');
      }
      list.refetch();
      closeAction();
    } catch (err) {
      const status = (err as { response?: { status?: number; data?: { message?: string } } })
        .response?.status;
      const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data
        ?.message;
      if (status === 409 && serverMessage) {
        toast.error(serverMessage);
      } else {
        toast.error(`Failed to ${actionType} application`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const copyPassword = () => {
    if (!credentials) return;
    navigator.clipboard.writeText(credentials.temporaryPassword);
    toast.success('Password copied to clipboard');
  };

  const columns: ColumnDef<TeacherApplication, unknown>[] = [
    { header: 'Full name', accessorKey: 'fullName' },
    { header: 'Email', accessorKey: 'email' },
    {
      header: 'Phone',
      accessorKey: 'phone',
      cell: ({ row }) => row.original.phone ?? '-',
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: 'Reviewed at',
      accessorKey: 'reviewedAt',
      cell: ({ row }) =>
        row.original.reviewedAt ? new Date(row.original.reviewedAt).toLocaleString() : '-',
    },
    {
      header: 'Review note',
      accessorKey: 'reviewNote',
      cell: ({ row }) => row.original.reviewNote ?? '-',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        canManage && row.original.status === 'PENDING' ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => openAction(row.original, 'approve')}>
              Approve
            </Button>
            <Button size="sm" variant="danger" onClick={() => openAction(row.original, 'reject')}>
              Reject
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Teacher Applications"
        variant="plain"
        actions={
          canManage && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New application
            </Button>
          )
        }
      />

      {canManage && (
        <p className="text-sm text-text-muted">
          This is an internal entry form for admins to record applications on behalf of
          candidates, pending a public applicant portal.
        </p>
      )}

      <DataTable<TeacherApplication>
        columns={columns}
        data={list.data ?? []}
        isLoading={list.isLoading}
      />

      <CrudFormModal
        open={createOpen}
        title="New application"
        fields={applicationFields}
        confirmLoading={creating}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <Modal
        open={Boolean(actionTarget)}
        title={actionType === 'approve' ? 'Approve application' : 'Reject application'}
        onClose={closeAction}
        footer={
          <>
            <Button variant="outline" onClick={closeAction} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'reject' ? 'destructive' : 'primary'}
              onClick={submitAction}
              loading={actionLoading}
            >
              Confirm
            </Button>
          </>
        }
      >
        <Field
          label={actionType === 'reject' ? 'Review note (required)' : 'Review note (optional)'}
          required={actionType === 'reject'}
          error={actionError ?? undefined}
        >
          <Textarea
            rows={3}
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
          />
        </Field>
      </Modal>

      <Modal
        open={Boolean(credentials)}
        title="Teacher account created"
        onClose={() => setCredentials(null)}
        footer={
          <Button onClick={() => setCredentials(null)}>I have saved this password</Button>
        }
      >
        <div className="mb-4 rounded-card border border-amber/30 bg-amber/10 p-3 text-sm text-amber">
          <p className="font-medium">This password is shown only once</p>
          <p className="mt-1 text-text-muted">
            Copy it now and share it securely with the new teacher. It cannot be retrieved again
            after closing this dialog.
          </p>
        </div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Temporary password:</p>
        <div className="mb-3 flex w-full gap-2">
          <Input readOnly value={credentials?.temporaryPassword ?? ''} className="flex-1" />
          <Button variant="outline" onClick={copyPassword}>
            <Copy className="h-4 w-4" />
            Copy
          </Button>
        </div>
        {credentials?.note && <p className="text-sm text-text-muted">{credentials.note}</p>}
      </Modal>
    </div>
  );
}
