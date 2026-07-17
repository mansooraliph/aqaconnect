import { NotFoundException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeeDemandsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recomputes a FeeDemand's persisted status/adjustedAmount/discountAmount
   * from its full PaymentAllocation history — the single source of truth
   * both Payments and Discounts write through after creating an allocation
   * row, so the two never drift into inconsistent bookkeeping.
   *
   * outstanding = demandAmount - adjustedAmount, where adjustedAmount folds
   * in PAYMENT + DISCOUNT + WAIVER (all reduce what's owed) and subtracts
   * REFUND (money given back reopens the balance). discountAmount is kept
   * as its own denormalized column (DISCOUNT-type allocations only) purely
   * for quick display, mirroring the old system's field of the same name —
   * it does not participate in the outstanding-balance math a second time.
   */
  async recalculateDemandStatus(tx: Prisma.TransactionClient, feeDemandId: string) {
    const allocations = await tx.paymentAllocation.findMany({ where: { feeDemandId } });
    const demand = await tx.feeDemand.findUniqueOrThrow({ where: { id: feeDemandId } });

    const sumBy = (type: string) =>
      allocations.filter((a) => a.type === type).reduce((sum, a) => sum + Number(a.amount), 0);

    const paid = sumBy('PAYMENT');
    const discount = sumBy('DISCOUNT');
    const waiver = sumBy('WAIVER');
    const refund = sumBy('REFUND');
    const adjustedAmount = paid + discount + waiver - refund;
    const outstanding = Number(demand.demandAmount) - adjustedAmount;

    const status =
      outstanding <= 0
        ? 'PAID'
        : adjustedAmount > 0
          ? 'PARTIALLY_PAID'
          : demand.dueDate && demand.dueDate.getTime() < Date.now()
            ? 'OVERDUE'
            : 'PENDING';

    return tx.feeDemand.update({
      where: { id: feeDemandId },
      data: {
        adjustedAmount,
        discountAmount: discount,
        status: status as never,
      },
    });
  }

  private async findStructureOrThrow(branchId: string, feeStructureId: string) {
    const structure = await this.prisma.feeStructure.findFirst({
      where: { id: feeStructureId, branchId },
      include: { installments: { orderBy: { sequenceNo: 'asc' } } },
    });
    if (!structure) {
      throw new NotFoundException('Fee structure not found');
    }
    return structure;
  }

  /** Students actively enrolled in the structure's class, for its academic year. */
  private async activelyEnrolledStudentIds(academicClassId: string, academicYearId: string) {
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        status: 'ACTIVE',
        academicClassSectionYear: {
          academicYearId,
          academicClassSection: { academicClassId },
        },
      },
      select: { studentId: true },
    });
    return [...new Set(enrollments.map((e) => e.studentId))];
  }

  /**
   * Dry run: shows what generation WOULD create, without writing anything.
   * "Missing" = a (student, installment) pair with no existing FeeDemand row.
   */
  async previewGeneration(branchId: string, feeStructureId: string) {
    const structure = await this.findStructureOrThrow(branchId, feeStructureId);
    const studentIds = await this.activelyEnrolledStudentIds(
      structure.academicClassId,
      structure.academicYearId,
    );

    const existing = await this.prisma.feeDemand.findMany({
      where: { feeStructureId, studentId: { in: studentIds } },
      select: { studentId: true, installmentId: true },
    });
    const existingKeys = new Set(existing.map((e) => `${e.studentId}:${e.installmentId}`));

    const missing: { studentId: string; installmentId: string; installmentName: string; amount: string }[] =
      [];
    for (const studentId of studentIds) {
      for (const installment of structure.installments) {
        if (!existingKeys.has(`${studentId}:${installment.id}`)) {
          missing.push({
            studentId,
            installmentId: installment.id,
            installmentName: installment.name,
            amount: installment.amount.toString(),
          });
        }
      }
    }

    return {
      enrolledStudentCount: studentIds.length,
      installmentCount: structure.installments.length,
      demandsToCreate: missing.length,
      items: missing,
    };
  }

  /**
   * Transactional, idempotent generation: creates a FeeDemand for every
   * (enrolled student x installment) pair that doesn't already have one.
   * Deliberately conservative per the Phase 1 deep-dive's recommendation —
   * an EXISTING demand is never touched, regardless of whether it has
   * allocations against it yet. This avoids any risk of clobbering a
   * partially-paid demand if installment amounts change after the fact;
   * amount corrections on an already-generated demand are a manual
   * FeeDemand update, not something regeneration does implicitly.
   */
  async generate(branchId: string, feeStructureId: string) {
    const structure = await this.findStructureOrThrow(branchId, feeStructureId);
    const studentIds = await this.activelyEnrolledStudentIds(
      structure.academicClassId,
      structure.academicYearId,
    );

    const existing = await this.prisma.feeDemand.findMany({
      where: { feeStructureId, studentId: { in: studentIds } },
      select: { studentId: true, installmentId: true },
    });
    const existingKeys = new Set(existing.map((e) => `${e.studentId}:${e.installmentId}`));

    const toCreate: { studentId: string; installmentId: string; amount: string; dueDate: Date }[] = [];
    for (const studentId of studentIds) {
      for (const installment of structure.installments) {
        if (!existingKeys.has(`${studentId}:${installment.id}`)) {
          toCreate.push({
            studentId,
            installmentId: installment.id,
            amount: installment.amount.toString(),
            dueDate: installment.dueDate,
          });
        }
      }
    }

    if (toCreate.length === 0) {
      return { created: 0, items: [] };
    }

    const created = await this.prisma.$transaction(
      toCreate.map((item) =>
        this.prisma.feeDemand.create({
          data: {
            branchId,
            studentId: item.studentId,
            feeStructureId,
            installmentId: item.installmentId,
            academicYearId: structure.academicYearId,
            demandAmount: item.amount,
            dueDate: item.dueDate,
          },
        }),
      ),
    );

    return { created: created.length, items: created };
  }

  async demandStatus(branchId: string, feeStructureId: string) {
    await this.findStructureOrThrow(branchId, feeStructureId);
    const [pending, partiallyPaid, paid, overdue] = await Promise.all([
      this.prisma.feeDemand.count({ where: { branchId, feeStructureId, status: 'PENDING' } }),
      this.prisma.feeDemand.count({ where: { branchId, feeStructureId, status: 'PARTIALLY_PAID' } }),
      this.prisma.feeDemand.count({ where: { branchId, feeStructureId, status: 'PAID' } }),
      this.prisma.feeDemand.count({ where: { branchId, feeStructureId, status: 'OVERDUE' } }),
    ]);
    return { pending, partiallyPaid, paid, overdue, total: pending + partiallyPaid + paid + overdue };
  }

  /** Pending-amount summary + list, per student. */
  async listForStudent(branchId: string, studentId: string) {
    const demands = await this.prisma.feeDemand.findMany({
      where: { branchId, studentId },
      include: {
        feeStructure: { include: { feeType: true } },
        installment: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    const pendingTotal = demands
      .filter((d) => d.status === 'PENDING' || d.status === 'PARTIALLY_PAID' || d.status === 'OVERDUE')
      .reduce((sum, d) => sum + Number(d.demandAmount) - Number(d.adjustedAmount) - Number(d.discountAmount), 0);

    return { pendingTotal, demands };
  }
}
