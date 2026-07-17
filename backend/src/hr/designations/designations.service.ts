import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { ChangeParentDto } from './dto/change-parent.dto';

const MAX_ANCESTOR_DEPTH = 50;

@Injectable()
export class DesignationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Flat list (not nested children) — the frontend builds the tree client-side
  // from `parentId`. Simpler than shipping nested includes, and avoids having
  // to pick an arbitrary nesting depth for the "shallow children" alternative.
  list(branchId: string) {
    return this.prisma.designation.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.designation.findFirst({
      where: { id, branchId },
      include: { children: true },
    });
    if (!record) {
      throw new NotFoundException('Designation not found');
    }
    return record;
  }

  private async assertParentBelongsToBranch(branchId: string, parentId: string) {
    const parent = await this.prisma.designation.findFirst({ where: { id: parentId, branchId } });
    if (!parent) {
      throw new BadRequestException('parentId must belong to this branch');
    }
  }

  async create(branchId: string, dto: CreateDesignationDto) {
    if (dto.parentId) {
      await this.assertParentBelongsToBranch(branchId, dto.parentId);
    }
    return this.prisma.designation.create({
      data: { branchId, name: dto.name, parentId: dto.parentId ?? null },
    });
  }

  private async findRecordOrThrow(branchId: string, id: string) {
    const record = await this.prisma.designation.findFirst({ where: { id, branchId } });
    if (!record) {
      throw new NotFoundException('Designation not found');
    }
    return record;
  }

  async update(branchId: string, id: string, dto: UpdateDesignationDto) {
    await this.findRecordOrThrow(branchId, id);
    return this.prisma.designation.update({
      where: { id },
      data: { name: dto.name, status: dto.status },
    });
  }

  async changeParent(branchId: string, id: string, dto: ChangeParentDto) {
    await this.findRecordOrThrow(branchId, id);

    const newParentId = dto.parentId ?? null;

    if (newParentId === null) {
      return this.prisma.designation.update({ where: { id }, data: { parentId: null } });
    }

    if (newParentId === id) {
      throw new BadRequestException('A designation cannot be its own parent');
    }

    await this.assertParentBelongsToBranch(branchId, newParentId);
    await this.assertNoCycle(id, newParentId);

    return this.prisma.designation.update({ where: { id }, data: { parentId: newParentId } });
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
        throw new BadRequestException('Designation hierarchy exceeds maximum allowed depth');
      }
      if (currentId === recordId) {
        throw new BadRequestException('This change would create a cycle in the designation hierarchy');
      }
      const current: { parentId: string | null } | null = await this.prisma.designation.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      currentId = current?.parentId ?? null;
      depth += 1;
    }
  }
}
