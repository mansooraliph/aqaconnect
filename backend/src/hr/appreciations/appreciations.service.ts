import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAppreciationDto } from './dto/create-appreciation.dto';

@Injectable()
export class AppreciationsService {
  constructor(private readonly prisma: PrismaService) {}

  private includeClause() {
    return {
      employee: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    };
  }

  private async assertEmployeeBelongsToBranch(branchId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, branchId } });
    if (!employee) {
      throw new BadRequestException('employeeId must belong to this branch');
    }
  }

  list(branchId: string, employeeId?: string) {
    return this.prisma.appreciation.findMany({
      where: { branchId, ...(employeeId && { employeeId }) },
      include: this.includeClause(),
      orderBy: { givenAt: 'desc' },
    });
  }

  async create(branchId: string, dto: CreateAppreciationDto, givenById?: string) {
    await this.assertEmployeeBelongsToBranch(branchId, dto.employeeId);
    return this.prisma.appreciation.create({
      data: {
        branchId,
        employeeId: dto.employeeId,
        title: dto.title,
        note: dto.note,
        givenById,
        givenAt: new Date(),
      },
      include: this.includeClause(),
    });
  }
}
