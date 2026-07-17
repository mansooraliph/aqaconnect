import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Copy, Plus } from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { useBranchResource } from '../../hooks/useResource';
import { CrudFormModal, type FieldDef } from '../../components/CrudFormModal';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Field, Input, Textarea } from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Checkbox';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { toast } from '../../components/ui/toast';

type AdmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface AcademicClass {
  id: string;
  name: string;
}

interface Admission {
  id: string;
  applicantName: string;
  guardianName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  desiredClassId: string | null;
  status: AdmissionStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export function AdmissionsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('student_management.admissions.manage');
  const canView = hasPermission('student_management.admissions.view');

  const { list, create, basePath } = useBranchResource<Admission>(activeBranchId, 'admissions');

  const academicClassesQuery = useQuery({
    queryKey: ['academic-classes', activeBranchId],
    queryFn: async () =>
      (await api.get<AcademicClass[]>(`/branches/${activeBranchId}/academic-classes`)).data,
    enabled: Boolean(activeBranchId),
  });

  const academicClassOptions = (academicClassesQuery.data ?? []).map((c) => ({
    label: c.name,
    value: c.id,
  }));

  const admissionFields: FieldDef[] = [
    { name: 'applicantName', label: 'Applicant name', type: 'text', required: true },
    { name: 'guardianName', label: 'Guardian name', type: 'text' },
    { name: 'email', label: 'Email', type: 'text' },
    { name: 'phone', label: 'Phone', type: 'text' },
    { name: 'dateOfBirth', label: 'Date of birth', type: 'date' },
    { name: 'desiredClassId', label: 'Desired class', type: 'select', options: academicClassOptions },
  ];

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [actionTarget, setActionTarget] = useState<Admission | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [studentCode, setStudentCode] = useState('');
  const [createLogin, setCreateLogin] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  const [credentials, setCredentials] = useState<{
    studentId: string;
    loginCreated: boolean;
    temporaryPassword?: string;
    note?: string;
  } | null>(null);

  const handleCreate = async (values: Record<string, unknown>) => {
    setCreating(true);
    try {
      await create.mutateAsync(values);
      toast.success('Admission created');
      setCreateOpen(false);
    } catch {
      toast.error('Failed to create admission');
    } finally {
      setCreating(false);
    }
  };

  const openAction = (record: Admission, type: 'approve' | 'reject') => {
    setActionTarget(record);
    setActionType(type);
    setStudentCode('');
    setCreateLogin(false);
    setReviewNote('');
    setActionErrors({});
  };

  const closeAction = () => {
    setActionTarget(null);
    setActionType(null);
    setStudentCode('');
    setCreateLogin(false);
    setReviewNote('');
    setActionErrors({});
  };

  const submitAction = async () => {
    if (!actionTarget || !actionType) return;

    const errors: Record<string, string> = {};
    if (actionType === 'approve' && !studentCode.trim()) {
      errors.studentCode = 'Student code is required';
    }
    if (actionType === 'reject' && !reviewNote.trim()) {
      errors.reviewNote = 'Review note is required';
    }
    setActionErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setActionLoading(true);
    try {
      if (actionType === 'approve') {
        const { data } = await api.post<{
          studentId: string;
          loginCreated: boolean;
          temporaryPassword?: string;
          note?: string;
        }>(`${basePath}/${actionTarget.id}/approve`, {
          studentCode,
          reviewNote: reviewNote || undefined,
          createLogin,
        });
        toast.success('Admission approved');
        if (data.loginCreated) {
          setCredentials(data);
        }
      } else {
        await api.post(`${basePath}/${actionTarget.id}/reject`, { reviewNote });
        toast.success('Admission rejected');
      }
      list.refetch();
      closeAction();
    } catch (err) {
      const status = (err as { response?: { status?: number; data?: { message?: string } } })
        .response?.status;
      const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data
        ?.message;
      if ((status === 409 || status === 400) && serverMessage) {
        toast.error(serverMessage);
      } else {
        toast.error(`Failed to ${actionType} admission`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const copyPassword = () => {
    if (!credentials?.temporaryPassword) return;
    navigator.clipboard.writeText(credentials.temporaryPassword);
    toast.success('Password copied to clipboard');
  };

  const columns: ColumnDef<Admission, unknown>[] = [
    { header: 'Applicant name', accessorKey: 'applicantName' },
    { header: 'Guardian name', accessorKey: 'guardianName', cell: ({ row }) => row.original.guardianName ?? '-' },
    { header: 'Email', accessorKey: 'email', cell: ({ row }) => row.original.email ?? '-' },
    { header: 'Phone', accessorKey: 'phone', cell: ({ row }) => row.original.phone ?? '-' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: 'Reviewed at',
      accessorKey: 'reviewedAt',
      cell: ({ row }) => (row.original.reviewedAt ? new Date(row.original.reviewedAt).toLocaleString() : '-'),
    },
    { header: 'Review note', accessorKey: 'reviewNote', cell: ({ row }) => row.original.reviewNote ?? '-' },
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

  if (!canView) {
    return (
      <div className="rounded-card border border-border bg-white p-5">
        <p className="text-sm text-text-muted">You do not have permission to view admissions.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Admissions"
        variant="plain"
        actions={
          canManage && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New admission
            </Button>
          )
        }
      />
      <DataTable<Admission> columns={columns} data={list.data ?? []} isLoading={list.isLoading} />

      <CrudFormModal
        open={createOpen}
        title="New admission"
        fields={admissionFields}
        confirmLoading={creating}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <Modal
        open={Boolean(actionTarget)}
        title={actionType === 'approve' ? 'Approve admission' : 'Reject admission'}
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
              {actionType === 'reject' ? 'Reject' : 'Approve'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {actionType === 'approve' && (
            <>
              <Field label="Student code" required error={actionErrors.studentCode}>
                <Input value={studentCode} onChange={(e) => setStudentCode(e.target.value)} />
              </Field>
              <label className="flex items-center gap-2">
                <Checkbox checked={createLogin} onChange={setCreateLogin} />
                <span className="text-sm text-text-primary">Create login account</span>
              </label>
            </>
          )}
          <Field
            label={actionType === 'reject' ? 'Review note (required)' : 'Review note (optional)'}
            required={actionType === 'reject'}
            error={actionErrors.reviewNote}
          >
            <Textarea rows={3} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(credentials)}
        title="Student account created"
        onClose={() => setCredentials(null)}
        footer={
          <Button onClick={() => setCredentials(null)}>I have saved this password</Button>
        }
      >
        <div className="mb-4 rounded-card border border-amber/30 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-text-primary">This password is shown only once</p>
          <p className="mt-1 text-text-muted">
            Copy it now and share it securely with the new student. It cannot be retrieved again
            after closing this dialog.
          </p>
        </div>
        <p className="mb-2 text-sm font-medium text-text-primary">Temporary password:</p>
        <div className="mb-3 flex gap-2">
          <Input readOnly value={credentials?.temporaryPassword ?? ''} />
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
