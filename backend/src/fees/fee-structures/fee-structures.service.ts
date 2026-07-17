import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFeeStructureDto, FeeFrequencyDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { UpsertInstallmentsDto } from './dto/upsert-installments.dto';

@Injectable()
export class FeeStructuresService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId: string) {
    return this.prisma.feeStructure.findMany({
      where: { branchId },
      include: { academicClass: true, academicYear: true, feeType: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.feeStructure.findFirst({
      where: { id, branchId },
      include: {
        academicClass: true,
        academicYear: true,
        feeType: true,
        installments: { orderBy: { sequenceNo: 'asc' } },
      },
    });
    if (!record) {
      throw new NotFoundException('Fee structure not found');
    }
    return record;
  }

  private async assertBelongsToBranch(
    branchId: string,
    academicClassId: string,
    academicYearId: string,
    feeTypeId: string,
  ) {
    const [cls, year, feeType] = await Promise.all([
      this.prisma.academicClass.findFirst({ where: { id: academicClassId, branchId } }),
      this.prisma.academicYear.findFirst({ where: { id: academicYearId, branchId } }),
      this.prisma.feeType.findFirst({ where: { id: feeTypeId, branchId } }),
    ]);
    if (!cls || !year || !feeType) {
      throw new BadRequestException(
        'academicClassId/academicYearId/feeTypeId must all belong to this branch',
      );
    }
  }

  /**
   * IDEMPOTENCY FIX (schema review Blocking #4): a ONE_TIME structure always
   * gets exactly one real FeeInstallment row created here, at creation time
   * — never left implicit — so FeeDemand's unique constraint on
   * [studentId, feeStructureId, installmentId, academicYearId] is a genuine
   * duplicate-generation guard for one-time fees too, not just
   * installment-based ones (Postgres unique indexes treat every NULL as
   * distinct, which is what made the old nullable-installmentId design
   * silently allow duplicates).
   */
  async create(branchId: string, dto: CreateFeeStructureDto) {
    await this.assertBelongsToBranch(branchId, dto.academicClassId, dto.academicYearId, dto.feeTypeId);

    const frequency = dto.frequency ?? FeeFrequencyDto.ONE_TIME;
    if (frequency === FeeFrequencyDto.ONE_TIME && !dto.dueDate) {
      throw new BadRequestException('dueDate is required when frequency is ONE_TIME');
    }

    return this.prisma.$transaction(async (tx) => {
      const structure = await tx.feeStructure.create({
        data: {
          branchId,
          academicClassId: dto.academicClassId,
          academicYearId: dto.academicYearId,
          feeTypeId: dto.feeTypeId,
          name: dto.name,
          amount: dto.amount,
          frequency: frequency as never,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          currency: dto.currency ?? 'INR',
        },
      });

      if (frequency === FeeFrequencyDto.ONE_TIME) {
        await tx.feeInstallment.create({
          data: {
            feeStructureId: structure.id,
            sequenceNo: 1,
            name: 'Full Payment',
            amount: dto.amount,
            dueDate: new Date(dto.dueDate!),
          },
        });
      }

      return tx.feeStructure.findUniqueOrThrow({
        where: { id: structure.id },
        include: { installments: true },
      });
    });
  }

  async update(branchId: string, id: string, dto: UpdateFeeStructureDto) {
    await this.findOne(branchId, id);
    return this.prisma.feeStructure.update({ where: { id }, data: dto });
  }

  /**
   * Only applies to INSTALLMENTS-frequency structures — ONE_TIME structures
   * get their single installment auto-created at creation time (see
   * `create` above) and must not have it edited through this endpoint.
   * Replace-all semantics: the posted set becomes the new complete set of
   * installments for this structure.
   */
  async upsertInstallments(branchId: string, id: string, dto: UpsertInstallmentsDto) {
    const structure = await this.findOne(branchId, id);
    if (structure.frequency !== 'INSTALLMENTS') {
      throw new BadRequestException(
        'Installments can only be set on an INSTALLMENTS-frequency fee structure',
      );
    }

    const keepSequenceNos = dto.installments.map((i) => i.sequenceNo);

    return this.prisma.$transaction(async (tx) => {
      await tx.feeInstallment.deleteMany({
        where: { feeStructureId: id, sequenceNo: { notIn: keepSequenceNos } },
      });
      for (const item of dto.installments) {
        await tx.feeInstallment.upsert({
          where: { feeStructureId_sequenceNo: { feeStructureId: id, sequenceNo: item.sequenceNo } },
          create: {
            feeStructureId: id,
            sequenceNo: item.sequenceNo,
            name: item.name,
            amount: item.amount,
            dueDate: new Date(item.dueDate),
          },
          update: {
            name: item.name,
            amount: item.amount,
            dueDate: new Date(item.dueDate),
          },
        });
      }
      return tx.feeInstallment.findMany({
        where: { feeStructureId: id },
        orderBy: { sequenceNo: 'asc' },
      });
    });
  }
}
