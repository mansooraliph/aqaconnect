import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useAuthStore } from '../../store/auth';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Field, Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { FilterSelect } from '../../components/ui/FilterSelect';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatCard } from '../../components/ui/StatCard';
import { toast } from '../../components/ui/toast';

interface Student {
  id: string;
  studentCode: string;
  name: string;
}

type DemandStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

interface FeeDemand {
  id: string;
  demandAmount: string | number;
  discountAmount: string | number;
  adjustedAmount: string | number;
  dueDate: string;
  status: DemandStatus;
  feeStructure: { name: string; feeType: { name: string } };
  installment: { name: string; sequenceNo: number };
}

interface FeeDemandsResponse {
  pendingTotal: string | number;
  demands: FeeDemand[];
}

type PaymentMode = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE' | 'CARD';
type PaymentStatus = 'PENDING' | 'COMPLETED';

interface PaymentAllocation {
  type: string;
  amount: string | number;
}

interface Payment {
  id: string;
  amount: string | number;
  paymentDate: string;
  mode: PaymentMode;
  status: PaymentStatus;
  receiptNumber: string | null;
  allocations: PaymentAllocation[];
  receipt: { fileUrl: string } | null;
}

interface AllocationAuditEntry {
  type: string;
  amount: string | number;
  reason: string | null;
  createdAt: string;
}

const PAYMENT_MODE_OPTIONS: { label: string; value: PaymentMode }[] = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Bank transfer', value: 'BANK_TRANSFER' },
  { label: 'Cheque', value: 'CHEQUE' },
  { label: 'Online', value: 'ONLINE' },
  { label: 'Card', value: 'CARD' },
];

function money(value: string | number | undefined | null): string {
  return Number(value ?? 0).toFixed(2);
}

function getErrorMessage(err: unknown, fallback: string): string {
  const serverMessage = (err as { response?: { data?: { message?: string } } }).response?.data
    ?.message;
  return serverMessage ?? fallback;
}

interface PaymentResult {
  id: string;
  amount: string | number;
  receiptNumber: string | null;
  receipt: { fileUrl: string } | null;
  allocations: { type: string; amount: string | number; feeDemandId?: string }[];
}

interface DiscountFormState {
  amount: string;
  type: 'DISCOUNT' | 'WAIVER';
  reason: string;
}

const EMPTY_DISCOUNT_FORM: DiscountFormState = { amount: '', type: 'DISCOUNT', reason: '' };

interface PaymentFormState {
  amount: string;
  paymentDate: string;
  mode: PaymentMode;
  reference: string;
  status: PaymentStatus;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_PAYMENT_FORM: PaymentFormState = {
  amount: '',
  paymentDate: today(),
  mode: 'CASH',
  reference: '',
  status: 'COMPLETED',
};

export function StudentFeeLedgerPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId) ?? undefined;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const queryClient = useQueryClient();

  const canViewDemands = hasPermission('fees.demands.view');
  const canViewPayments = hasPermission('fees.payments.view');
  const canCreatePayment = hasPermission('fees.payments.create');
  const canCreateDiscount = hasPermission('fees.discounts.create');
  const canViewDiscountHistory = hasPermission('fees.discounts.view');

  const [studentId, setStudentId] = useState<string>('');

  const studentsQuery = useQuery({
    queryKey: ['students', activeBranchId],
    queryFn: async () => (await api.get<Student[]>(`/branches/${activeBranchId}/students`)).data,
    enabled: Boolean(activeBranchId),
  });

  const studentOptions = (studentsQuery.data ?? []).map((s) => ({
    label: s.name,
    sublabel: s.studentCode,
    value: s.id,
  }));

  const feeDemandsQueryKey = ['fee-demands', activeBranchId, studentId];
  const feeDemandsQuery = useQuery({
    queryKey: feeDemandsQueryKey,
    queryFn: async () =>
      (
        await api.get<FeeDemandsResponse>(
          `/branches/${activeBranchId}/students/${studentId}/fee-demands`,
        )
      ).data,
    enabled: Boolean(activeBranchId && studentId && canViewDemands),
  });

  const paymentsQueryKey = ['student-payments', activeBranchId, studentId];
  const paymentsQuery = useQuery({
    queryKey: paymentsQueryKey,
    queryFn: async () =>
      (
        await api.get<Payment[]>(`/branches/${activeBranchId}/students/${studentId}/payments`)
      ).data,
    enabled: Boolean(activeBranchId && studentId && canViewPayments),
  });

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: feeDemandsQueryKey });
    queryClient.invalidateQueries({ queryKey: paymentsQueryKey });
  };

  // ---- Discount modal ----
  const [discountTarget, setDiscountTarget] = useState<FeeDemand | null>(null);
  const [discountForm, setDiscountForm] = useState<DiscountFormState>(EMPTY_DISCOUNT_FORM);
  const [discountErrors, setDiscountErrors] = useState<Record<string, string>>({});
  const [discountLoading, setDiscountLoading] = useState(false);

  const openDiscount = (record: FeeDemand) => {
    setDiscountTarget(record);
    setDiscountForm(EMPTY_DISCOUNT_FORM);
    setDiscountErrors({});
  };

  const closeDiscount = () => {
    setDiscountTarget(null);
    setDiscountForm(EMPTY_DISCOUNT_FORM);
    setDiscountErrors({});
  };

  const submitDiscount = async () => {
    if (!discountTarget) return;
    const errors: Record<string, string> = {};
    if (discountForm.amount === '' || Number(discountForm.amount) <= 0) {
      errors.amount = 'Amount is required';
    }
    if (!discountForm.reason.trim()) errors.reason = 'Reason is required';
    setDiscountErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setDiscountLoading(true);
    try {
      await api.post(`/branches/${activeBranchId}/fee-demands/${discountTarget.id}/discount`, {
        amount: Number(discountForm.amount),
        reason: discountForm.reason,
        type: discountForm.type,
      });
      toast.success('Discount applied');
      refetchAll();
      closeDiscount();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to apply discount'));
    } finally {
      setDiscountLoading(false);
    }
  };

  // ---- Allocation history modal (shared by demand history + payment allocations) ----
  const [historyDemandId, setHistoryDemandId] = useState<string | null>(null);
  const historyQuery = useQuery({
    queryKey: ['fee-demand-allocations', activeBranchId, historyDemandId],
    queryFn: async () =>
      (
        await api.get<AllocationAuditEntry[]>(
          `/branches/${activeBranchId}/fee-demands/${historyDemandId}/allocations`,
        )
      ).data,
    enabled: Boolean(activeBranchId && historyDemandId),
  });

  // ---- Payment allocations inline modal (from payment history row) ----
  const [paymentAllocations, setPaymentAllocations] = useState<Payment | null>(null);

  // ---- Record payment modal ----
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(EMPTY_PAYMENT_FORM);
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  const setPaymentField = <K extends keyof PaymentFormState>(name: K, value: PaymentFormState[K]) => {
    setPaymentForm((f) => ({ ...f, [name]: value }));
  };

  const openPaymentModal = () => {
    setPaymentModalOpen(true);
    setPaymentForm(EMPTY_PAYMENT_FORM);
    setPaymentErrors({});
  };

  const closePaymentModal = () => {
    setPaymentModalOpen(false);
    setPaymentForm(EMPTY_PAYMENT_FORM);
    setPaymentErrors({});
  };

  const submitPayment = async () => {
    const errors: Record<string, string> = {};
    if (paymentForm.amount === '' || Number(paymentForm.amount) <= 0) {
      errors.amount = 'Amount is required';
    }
    if (!paymentForm.paymentDate) errors.paymentDate = 'Payment date is required';
    if (!paymentForm.mode) errors.mode = 'Mode is required';
    if (!paymentForm.status) errors.status = 'Status is required';
    setPaymentErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPaymentSubmitting(true);
    try {
      const { data } = await api.post<PaymentResult>(
        `/branches/${activeBranchId}/students/${studentId}/payments`,
        {
          amount: Number(paymentForm.amount),
          paymentDate: paymentForm.paymentDate,
          mode: paymentForm.mode,
          reference: paymentForm.reference || undefined,
          status: paymentForm.status,
        },
      );
      toast.success('Payment recorded');
      refetchAll();
      closePaymentModal();
      setPaymentResult(data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to record payment'));
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const confirmPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) =>
      (await api.post<PaymentResult>(`/branches/${activeBranchId}/payments/${paymentId}/confirm`))
        .data,
    onSuccess: (data) => {
      toast.success('Payment confirmed');
      refetchAll();
      setPaymentResult(data);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, 'Failed to confirm payment'));
    },
  });

  const demandColumns: ColumnDef<FeeDemand, unknown>[] = [
    {
      id: 'feeTypeStructure',
      header: 'Fee type / structure',
      cell: ({ row }) => `${row.original.feeStructure.feeType.name} - ${row.original.feeStructure.name}`,
    },
    {
      id: 'installment',
      header: 'Installment',
      cell: ({ row }) => row.original.installment.name,
    },
    {
      id: 'demandAmount',
      header: 'Demand amount',
      cell: ({ row }) => money(row.original.demandAmount),
    },
    {
      id: 'discountAmount',
      header: 'Discount',
      cell: ({ row }) => money(row.original.discountAmount),
    },
    {
      id: 'adjustedAmount',
      header: 'Adjusted amount',
      cell: ({ row }) => money(row.original.adjustedAmount),
    },
    {
      id: 'outstanding',
      header: 'Outstanding',
      cell: ({ row }) =>
        money(Number(row.original.demandAmount) - Number(row.original.adjustedAmount)),
    },
    {
      header: 'Due date',
      accessorKey: 'dueDate',
      cell: ({ row }) => (row.original.dueDate ? new Date(row.original.dueDate).toLocaleDateString() : '-'),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {canCreateDiscount && (
            <Button size="sm" variant="outline" onClick={() => openDiscount(row.original)}>
              Apply discount
            </Button>
          )}
          {canViewDiscountHistory && (
            <Button size="sm" variant="outline" onClick={() => setHistoryDemandId(row.original.id)}>
              View history
            </Button>
          )}
        </div>
      ),
    },
  ];

  const paymentColumns: ColumnDef<Payment, unknown>[] = [
    {
      header: 'Payment date',
      accessorKey: 'paymentDate',
      cell: ({ row }) =>
        row.original.paymentDate ? new Date(row.original.paymentDate).toLocaleDateString() : '-',
    },
    { id: 'amount', header: 'Amount', cell: ({ row }) => money(row.original.amount) },
    { header: 'Mode', accessorKey: 'mode' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: 'Receipt #',
      accessorKey: 'receiptNumber',
      cell: ({ row }) => row.original.receiptNumber ?? '-',
    },
    {
      id: 'allocations',
      header: 'Allocations',
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => setPaymentAllocations(row.original)}>
          {row.original.allocations?.length ?? 0} allocation(s)
        </Button>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'PENDING' && canCreatePayment ? (
          <Button
            size="sm"
            loading={confirmPaymentMutation.isPending}
            onClick={() => confirmPaymentMutation.mutate(row.original.id)}
          >
            Confirm
          </Button>
        ) : null,
    },
  ];

  if (!canViewDemands) {
    return (
      <div className="rounded-card border border-border bg-white p-5">
        <p className="text-sm text-text-muted">You do not have permission to view fee demands.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Student Fee Ledger" variant="plain" />

      <FilterSelect
        label="Student"
        value={studentId}
        onChange={setStudentId}
        placeholder="Select a student"
        options={studentOptions}
        disabled={studentsQuery.isLoading}
        width="max-w-sm"
      />

      {studentId && (
        <>
          <StatCard
            title="Pending total"
            value={money(feeDemandsQuery.data?.pendingTotal ?? 0)}
            isLoading={feeDemandsQuery.isLoading}
          />

          <div>
            <h2 className="mb-2 text-base font-semibold text-text-primary">Fee demands</h2>
            <DataTable<FeeDemand>
              columns={demandColumns}
              data={feeDemandsQuery.data?.demands ?? []}
              isLoading={feeDemandsQuery.isLoading}
            />
          </div>

          <div>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-base font-semibold text-text-primary">Payment history</h2>
              {canCreatePayment && <Button onClick={openPaymentModal}>Record payment</Button>}
            </div>
            <DataTable<Payment>
              columns={paymentColumns}
              data={paymentsQuery.data ?? []}
              isLoading={paymentsQuery.isLoading}
            />
          </div>
        </>
      )}

      {/* Apply discount modal */}
      <Modal
        open={Boolean(discountTarget)}
        title="Apply discount"
        onClose={closeDiscount}
        footer={
          <>
            <Button variant="outline" onClick={closeDiscount} disabled={discountLoading}>
              Cancel
            </Button>
            <Button onClick={submitDiscount} loading={discountLoading}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Amount" required error={discountErrors.amount}>
            <Input
              type="number"
              min={0.01}
              value={discountForm.amount}
              onChange={(e) => setDiscountForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </Field>
          <Field label="Type" required>
            <Select
              value={discountForm.type}
              onChange={(e) =>
                setDiscountForm((f) => ({ ...f, type: e.target.value as 'DISCOUNT' | 'WAIVER' }))
              }
              options={[
                { label: 'Discount', value: 'DISCOUNT' },
                { label: 'Waiver', value: 'WAIVER' },
              ]}
            />
          </Field>
          <Field label="Reason" required error={discountErrors.reason}>
            <Input
              value={discountForm.reason}
              onChange={(e) => setDiscountForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </Field>
        </div>
      </Modal>

      {/* Demand allocation history modal */}
      <Modal
        open={Boolean(historyDemandId)}
        title="Allocation history"
        onClose={() => setHistoryDemandId(null)}
        footer={<Button onClick={() => setHistoryDemandId(null)}>Close</Button>}
      >
        <DataTable<AllocationAuditEntry>
          isLoading={historyQuery.isLoading}
          data={historyQuery.data ?? []}
          columns={[
            { header: 'Type', accessorKey: 'type' },
            { id: 'amount', header: 'Amount', cell: ({ row }) => money(row.original.amount) },
            { header: 'Reason', accessorKey: 'reason', cell: ({ row }) => row.original.reason ?? '-' },
            {
              header: 'Date',
              accessorKey: 'createdAt',
              cell: ({ row }) => (row.original.createdAt ? new Date(row.original.createdAt).toLocaleString() : '-'),
            },
          ]}
        />
      </Modal>

      {/* Payment allocations inline modal */}
      <Modal
        open={Boolean(paymentAllocations)}
        title="Payment allocations"
        onClose={() => setPaymentAllocations(null)}
        footer={<Button onClick={() => setPaymentAllocations(null)}>Close</Button>}
      >
        <DataTable<PaymentAllocation>
          data={paymentAllocations?.allocations ?? []}
          columns={[
            { header: 'Type', accessorKey: 'type' },
            { id: 'amount', header: 'Amount', cell: ({ row }) => money(row.original.amount) },
          ]}
        />
      </Modal>

      {/* Record payment modal */}
      <Modal
        open={paymentModalOpen}
        title="Record payment"
        onClose={closePaymentModal}
        footer={
          <>
            <Button variant="outline" onClick={closePaymentModal} disabled={paymentSubmitting}>
              Cancel
            </Button>
            <Button onClick={submitPayment} loading={paymentSubmitting}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Amount" required error={paymentErrors.amount}>
            <Input
              type="number"
              min={0.01}
              value={paymentForm.amount}
              onChange={(e) => setPaymentField('amount', e.target.value)}
            />
          </Field>
          <Field label="Payment date" required error={paymentErrors.paymentDate}>
            <Input
              type="date"
              value={paymentForm.paymentDate}
              onChange={(e) => setPaymentField('paymentDate', e.target.value)}
            />
          </Field>
          <Field label="Mode" required error={paymentErrors.mode}>
            <Select
              value={paymentForm.mode}
              onChange={(e) => setPaymentField('mode', e.target.value as PaymentMode)}
              options={PAYMENT_MODE_OPTIONS}
            />
          </Field>
          <Field label="Reference">
            <Input
              value={paymentForm.reference}
              onChange={(e) => setPaymentField('reference', e.target.value)}
            />
          </Field>
          <Field label="Status" required error={paymentErrors.status}>
            <Select
              value={paymentForm.status}
              onChange={(e) => setPaymentField('status', e.target.value as PaymentStatus)}
              options={[
                { label: 'Completed', value: 'COMPLETED' },
                { label: 'Pending', value: 'PENDING' },
              ]}
            />
          </Field>
        </div>
      </Modal>

      {/* Payment result / receipt modal */}
      <Modal
        open={Boolean(paymentResult)}
        title="Payment result"
        onClose={() => setPaymentResult(null)}
        footer={<Button onClick={() => setPaymentResult(null)}>Close</Button>}
      >
        {paymentResult && (
          <>
            <div className="mb-4 rounded-card border border-green/30 bg-green-50 p-4 text-sm">
              <p className="font-medium text-text-primary">Payment processed</p>
              <p className="mt-1 text-text-muted">
                {paymentResult.receiptNumber
                  ? `Receipt number: ${paymentResult.receiptNumber}`
                  : 'This payment is pending confirmation.'}
              </p>
            </div>
            <p className="mb-2 text-sm text-text-primary">
              <strong>Amount:</strong> {money(paymentResult.amount)}
            </p>
            {paymentResult.receipt?.fileUrl && (
              <p className="mb-2 text-sm">
                <a
                  href={paymentResult.receipt.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue hover:underline"
                >
                  View receipt file
                </a>
              </p>
            )}
            {paymentResult.allocations?.length > 0 && (
              <>
                <p className="mb-2 text-sm text-text-primary">
                  <strong>Demands paid:</strong>
                </p>
                <DataTable<{ type: string; amount: string | number; feeDemandId?: string }>
                  data={paymentResult.allocations}
                  columns={[
                    { header: 'Type', accessorKey: 'type' },
                    { id: 'amount', header: 'Amount', cell: ({ row }) => money(row.original.amount) },
                  ]}
                />
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
