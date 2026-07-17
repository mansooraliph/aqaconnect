import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { UserAccessContext } from '../rbac/access-control.service';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(accessContext: UserAccessContext) {
    if (accessContext.isGlobal) {
      return this.prisma.user.findMany({
        select: this.publicSelect(),
        orderBy: { email: 'asc' },
      });
    }
    return this.prisma.user.findMany({
      where: { branchId: { in: Array.from(accessContext.allowedBranchIds) } },
      select: this.publicSelect(),
      orderBy: { email: 'asc' },
    });
  }

  private publicSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
      branchId: true,
      lastLoginAt: true,
      createdAt: true,
    };
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        branchId: dto.branchId,
      },
    });
    const { passwordHash: _omit, ...rest } = user;
    return rest;
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { ...this.publicSelect(), userRoles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async assignRole(userId: string, dto: AssignRoleDto) {
    await this.findOne(userId);
    // Not a plain `upsert` by compound key: Prisma's generated compound-unique
    // input type requires a non-null branchId even though the column is
    // nullable (NULL branchId = a GLOBAL-role grant) — same class of
    // NULL-in-unique-constraint caveat already flagged in the schema review.
    const branchId = dto.branchId ?? null;
    const existing = await this.prisma.userRole.findFirst({
      where: { userId, roleId: dto.roleId, branchId },
      include: { role: true },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.userRole.create({
      data: { userId, roleId: dto.roleId, branchId: dto.branchId },
      include: { role: true },
    });
  }
}
