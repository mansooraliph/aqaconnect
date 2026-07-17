import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFeeTypeDto } from './dto/create-fee-type.dto';
import { UpdateFeeTypeDto } from './dto/update-fee-type.dto';

@Injectable()
export class FeeTypesService {
  constructor(private readonly prisma: PrismaService) {}

  list(branchId: string) {
    return this.prisma.feeType.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.feeType.findFirst({ where: { id, branchId } });
    if (!record) {
      throw new NotFoundException('Fee type not found');
    }
    return record;
  }

  create(branchId: string, dto: CreateFeeTypeDto) {
    return this.prisma.feeType.create({ data: { branchId, name: dto.name } });
  }

  async update(branchId: string, id: string, dto: UpdateFeeTypeDto) {
    await this.findOne(branchId, id);
    return this.prisma.feeType.update({ where: { id }, data: dto });
  }
}
