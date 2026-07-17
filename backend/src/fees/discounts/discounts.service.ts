import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FeeDemandsService } from '../fee-demands/fee-demands.service';
import { CreateDiscountDto } from './dto/create-discount.dto';

@Injectable()
export class DiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feeDemands: FeeDemandsService,
  ) {}

  private async assertDemandBelongsToBranch(branchId: string, demandId: string) {
    const demand = await this.prisma.feeDemand.findFirst({ where: { id: demandId, branchId } });
    if (!demand) {
      throw new NotFoundException('Fee demand not found');
    }
    return demand;
  }

  /**
   * Every discount/waiver produces an auditable PaymentAllocation row —
   * this fixes the Phase 1-audited bug where the old system mutated
   * FeeDemand directly with no ledger trail. Same overpayment-guard
   * philosophy as PaymentsService.allocateAndComplete: a discount may
   * bring outstanding to exactly zero, never negative.
   */
  async create(branchId: string, demandId: string, userId: string, dto: CreateDiscountDto) {
    await this.assertDemandBelongsToBranch(branchId, demandId);

    return this.prisma.$transaction(async (tx) => {
      const demand = await tx.feeDemand.findFirst({ where: { id: demandId, branchId } });
      if (!demand) {
        throw new NotFoundException('Fee demand not found');
      }

      const outstanding = Number(demand.demandAmount) - Number(demand.adjustedAmount);
      if (dto.amount > outstanding + 0.001) {
        throw new BadRequestException(
          `Discount of ${dto.amount} exceeds outstanding balance of ${outstanding.toFixed(2)} — a discount cannot bring a demand below zero`,
        );
      }

      await tx.paymentAllocation.create({
        data: {
          feeDemandId: demandId,
          paymentId: null,
          type: dto.type ?? 'DISCOUNT',
          amount: dto.amount,
          reason: dto.reason,
          createdById: userId,
        },
      });

      return this.feeDemands.recalculateDemandStatus(tx, demandId);
    });
  }

  async listAllocations(branchId: string, demandId: string) {
    await this.assertDemandBelongsToBranch(branchId, demandId);
    return this.prisma.paymentAllocation.findMany({
      where: { feeDemandId: demandId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
