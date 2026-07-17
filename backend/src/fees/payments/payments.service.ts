import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FeeDemandsService } from '../fee-demands/fee-demands.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feeDemands: FeeDemandsService,
  ) {}

  list(branchId: string, studentId: string) {
    return this.prisma.payment.findMany({
      where: { branchId, studentId },
      include: { allocations: true, receipt: true },
      orderBy: { paymentDate: 'desc' },
    });
  }

  private async assertStudentBelongsToBranch(branchId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, branchId } });
    if (!student) {
      throw new BadRequestException('studentId must belong to this branch');
    }
  }

  private async nextReceiptNumber(): Promise<string> {
    // Real DB sequence (not regex-parsed from prior receipts like the old
    // system) — created lazily so no separate migration file is needed.
    await this.prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS receipt_number_seq`);
    const result = await this.prisma.$queryRawUnsafe<{ nextval: bigint }[]>(
      `SELECT nextval('receipt_number_seq')`,
    );
    const seq = result[0].nextval.toString().padStart(6, '0');
    return `RCPT-${new Date().getFullYear()}-${seq}`;
  }

  /**
   * FIFO allocation across the student's outstanding demands, oldest
   * dueDate first. Default no-overpayment policy (matches the old system's
   * behavior) — rejects upfront, before writing anything, if the payment
   * amount exceeds total outstanding. This is an explicit product decision
   * flagged for revisit, not an accidental limitation. Runs entirely inside
   * the caller's transaction so a rejected allocation can't leave a
   * dangling PENDING Payment row behind (see `create`/`confirm`).
   */
  private async allocateAndComplete(
    tx: Prisma.TransactionClient,
    paymentId: string,
    studentId: string,
    amount: number,
  ) {
    const demands = await tx.feeDemand.findMany({
      where: { studentId, status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } },
      orderBy: { dueDate: 'asc' },
    });
    const outstanding = demands
      .map((d) => ({ demand: d, outstanding: Number(d.demandAmount) - Number(d.adjustedAmount) }))
      .filter((d) => d.outstanding > 0.001);
    const totalOutstanding = outstanding.reduce((sum, d) => sum + d.outstanding, 0);

    if (amount > totalOutstanding + 0.001) {
      throw new BadRequestException(
        `Payment of ${amount} exceeds total outstanding balance of ${totalOutstanding.toFixed(2)} — overpayment is not allowed`,
      );
    }

    let remaining = amount;
    for (const { demand, outstanding: demandOutstanding } of outstanding) {
      if (remaining <= 0.001) break;
      const allocate = Math.min(remaining, demandOutstanding);
      await tx.paymentAllocation.create({
        data: { feeDemandId: demand.id, paymentId, type: 'PAYMENT', amount: allocate },
      });
      await this.feeDemands.recalculateDemandStatus(tx, demand.id);
      remaining -= allocate;
    }

    const receiptNumber = await this.nextReceiptNumber();
    await tx.payment.update({ where: { id: paymentId }, data: { status: 'COMPLETED', receiptNumber } });
    await tx.receipt.create({
      data: {
        paymentId,
        // Real PDF generation is out of scope for this phase — tracked as a
        // record with a placeholder path rather than actually rendered.
        fileUrl: `/receipts/${receiptNumber}.pdf`,
      },
    });

    return tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { allocations: true, receipt: true },
    });
  }

  async create(branchId: string, studentId: string, dto: CreatePaymentDto) {
    await this.assertStudentBelongsToBranch(branchId, studentId);
    const status = dto.status ?? 'COMPLETED';

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          branchId,
          studentId,
          amount: dto.amount,
          paymentDate: new Date(dto.paymentDate),
          mode: dto.mode as never,
          reference: dto.reference,
          proofFileUrl: dto.proofFileUrl,
          status: 'PENDING',
        },
      });

      if (status === 'PENDING') {
        return payment;
      }
      return this.allocateAndComplete(tx, payment.id, studentId, dto.amount);
    });
  }

  /** Confirms a PENDING payment (e.g. a cheque clearing) — only now does allocation/receipt happen. */
  async confirm(branchId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id, branchId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status !== 'PENDING') {
      throw new BadRequestException('Only a PENDING payment can be confirmed');
    }
    return this.prisma.$transaction((tx) =>
      this.allocateAndComplete(tx, payment.id, payment.studentId, Number(payment.amount)),
    );
  }
}
