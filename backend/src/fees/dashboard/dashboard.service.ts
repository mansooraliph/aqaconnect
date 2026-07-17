import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeesDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(branchId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [outstandingRows, recentPayments] = await Promise.all([
      this.prisma.$queryRaw<{ total: string | null }[]>`
        SELECT SUM(GREATEST("demandAmount" - "adjustedAmount", 0)) as total
        FROM "FeeDemand"
        WHERE "branchId" = ${branchId} AND status != 'PAID'
      `,
      this.prisma.payment.aggregate({
        where: { branchId, paymentDate: { gte: thirtyDaysAgo } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    const totalOutstandingBalance = Number(outstandingRows[0]?.total ?? 0);

    return {
      totalOutstandingBalance,
      recentPaymentsCount: recentPayments._count._all,
      recentPaymentsAmount: Number(recentPayments._sum.amount ?? 0),
    };
  }
}
