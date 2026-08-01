import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ActiveStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreAcademicClassDto } from './dto/store-academic-class.dto';
import { UpdateAcademicClassDto } from './dto/update-academic-class.dto';

const include = { addedBy: true, lastUpdatedBy: true } as const;

function toStatusEnum(status?: 'active' | 'inactive'): ActiveStatus | undefined {
  if (!status) return undefined;
  return status === 'active' ? ActiveStatus.ACTIVE : ActiveStatus.INACTIVE;
}

function serializeUser(user: { id: string; firstName: string; lastName: string | null } | null) {
  if (!user) return null;
  return { id: user.id, name: [user.firstName, user.lastName].filter(Boolean).join(' ') };
}

function serialize(academicClass: {
  id: string;
  name: string;
  code: string | null;
  status: ActiveStatus;
  branchId: string;
  addedBy: { id: string; firstName: string; lastName: string | null } | null;
  lastUpdatedBy: { id: string; firstName: string; lastName: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: academicClass.id,
    company_id: academicClass.branchId,
    name: academicClass.name,
    code: academicClass.code,
    status: academicClass.status === ActiveStatus.ACTIVE ? 'active' : 'inactive',
    added_by: serializeUser(academicClass.addedBy),
    last_updated_by: serializeUser(academicClass.lastUpdatedBy),
    created_at: academicClass.createdAt,
    updated_at: academicClass.updatedAt,
  };
}

@Injectable()
export class AcademicClassesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCodeAvailable(branchId: string, code: string | undefined, excludeId?: string) {
    if (!code) return;
    const existing = await this.prisma.academicClass.findFirst({
      where: { branchId, code, ...(excludeId && { id: { not: excludeId } }) },
    });
    if (existing) {
      throw new UnprocessableEntityException({
        status: 'error',
        message: 'The code has already been taken.',
      });
    }
  }

  async store(branchId: string, userId: string, dto: StoreAcademicClassDto) {
    await this.assertCodeAvailable(branchId, dto.code);

    const created = await this.prisma.academicClass.create({
      data: {
        branchId,
        name: dto.name,
        code: dto.code,
        status: toStatusEnum(dto.status) ?? ActiveStatus.ACTIVE,
        addedById: userId,
        lastUpdatedById: userId,
      },
      include,
    });

    return serialize(created);
  }

  async update(branchId: string, userId: string, id: string, dto: UpdateAcademicClassDto) {
    const existing = await this.prisma.academicClass.findFirst({ where: { id, branchId } });
    if (!existing) {
      throw new NotFoundException({
        status: 'error',
        message: 'Class not found or does not belong to your company.',
      });
    }

    await this.assertCodeAvailable(branchId, dto.code, id);

    const updated = await this.prisma.academicClass.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.status !== undefined && { status: toStatusEnum(dto.status) }),
        lastUpdatedById: userId,
      },
      include,
    });

    return serialize(updated);
  }
}
