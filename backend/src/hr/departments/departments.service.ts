import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { ChangeParentDto } from './dto/change-parent.dto';

const MAX_ANCESTOR_DEPTH = 50;

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Flat list (not nested children) — the frontend builds the tree client-side
  // from `parentId`. Simpler than shipping nested includes, and avoids having
  // to pick an arbitrary nesting depth for the "shallow children" alternative.
  list(branchId: string) {
    return this.prisma.department.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.department.findFirst({
      where: { id, branchId },
      include: { children: true },
    });
    if (!record) {
      throw new NotFoundException('Department not found');
    }
    return record;
  }

  private async assertParentBelongsToBranch(branchId: string, parentId: string) {
    const parent = await this.prisma.department.findFirst({ where: { id: parentId, branchId } });
    if (!parent) {
      throw new BadRequestException('parentId must belong to this branch');
    }
  }

  async create(branchId: string, dto: CreateDepartmentDto) {
    if (dto.parentId) {
      await this.assertParentBelongsToBranch(branchId, dto.parentId);
    }
    return this.prisma.department.create({
      data: { branchId, name: dto.name, parentId: dto.parentId ?? null },
    });
  }

  private async findRecordOrThrow(branchId: string, id: string) {
    const record = await this.prisma.department.findFirst({ where: { id, branchId } });
    if (!record) {
      throw new NotFoundException('Department not found');
    }
    return record;
  }

  async update(branchId: string, id: string, dto: UpdateDepartmentDto) {
    await this.findRecordOrThrow(branchId, id);
    return this.prisma.department.update({
      where: { id },
      data: { name: dto.name, status: dto.status },
    });
  }

  async changeParent(branchId: string, id: string, dto: ChangeParentDto) {
    await this.findRecordOrThrow(branchId, id);

    const newParentId = dto.parentId ?? null;

    if (newParentId === null) {
      return this.prisma.department.update({ where: { id }, data: { parentId: null } });
    }

    if (newParentId === id) {
      throw new BadRequestException('A department cannot be its own parent');
    }

    await this.assertParentBelongsToBranch(branchId, newParentId);
    await this.assertNoCycle(id, newParentId);

    return this.prisma.department.update({ where: { id }, data: { parentId: newParentId } });
  }

  /**
   * Walks up the ancestor chain of `candidateParentId`; if it ever reaches
   * `recordId`, assigning `candidateParentId` as the parent of `recordId`
   * would create a cycle. Capped at MAX_ANCESTOR_DEPTH as a safety net
   * against a pre-existing bad chain in the data.
   */
  private async assertNoCycle(recordId: string, candidateParentId: string) {
    let currentId: string | null = candidateParentId;
    let depth = 0;

    while (currentId !== null) {
      if (depth > MAX_ANCESTOR_DEPTH) {
        throw new BadRequestException('Department hierarchy exceeds maximum allowed depth');
      }
      if (currentId === recordId) {
        throw new BadRequestException('This change would create a cycle in the department hierarchy');
      }
      const current: { parentId: string | null } | null = await this.prisma.department.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      currentId = current?.parentId ?? null;
      depth += 1;
    }
  }
}
