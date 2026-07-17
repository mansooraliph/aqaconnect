import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UserAccessContext } from '../rbac/access-control.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Branches visible to this user: all of them if global, else only their assigned branches. */
  async listForUser(accessContext: UserAccessContext) {
    if (accessContext.isGlobal) {
      return this.prisma.branch.findMany({ orderBy: { name: 'asc' } });
    }
    return this.prisma.branch.findMany({
      where: { id: { in: Array.from(accessContext.allowedBranchIds) } },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateBranchDto) {
    return this.prisma.branch.create({ data: dto });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: { settings: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findOne(id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }
}
