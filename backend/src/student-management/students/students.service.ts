import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { BulkActionDto } from '../../common/dto/bulk-action.dto';
import { HifdhService } from '../../academic/hifdh/hifdh.service';

const SALT_ROUNDS = 10;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hifdh: HifdhService,
  ) {}

  private userSelect() {
    return {
      select: {
        username: true,
        email: true,
        isActive: true,
      },
    };
  }

  private includeClause() {
    return {
      user: this.userSelect(),
    };
  }

  list(branchId: string, status?: string) {
    return this.prisma.student.findMany({
      where: { branchId, ...(status && { status: status as never }) },
      include: this.includeClause(),
      orderBy: { studentCode: 'asc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.student.findFirst({
      where: { id, branchId },
      include: this.includeClause(),
    });
    if (!record) {
      throw new NotFoundException('Student not found');
    }
    return record;
  }

  /**
   * Direct student creation, bypassing the Admission workflow. Student.userId
   * is nullable — most students are guardian-managed with no portal account
   * of their own — so a login is only provisioned when `createLogin` is
   * explicitly requested, with an auto-generated password, mirroring
   * AdmissionsService.approve's pattern for consistency.
   */
  async create(branchId: string, dto: CreateStudentDto) {
    const existingCode = await this.prisma.student.findFirst({
      where: { branchId, studentCode: dto.studentCode },
    });
    if (existingCode) {
      throw new ConflictException(`A student with code ${dto.studentCode} already exists in this branch`);
    }

    if (dto.createLogin && !dto.username) {
      throw new BadRequestException('username is required when createLogin is true');
    }

    if (dto.createLogin) {
      const existingUser = await this.prisma.user.findUnique({ where: { username: dto.username! } });
      if (existingUser) {
        throw new ConflictException(`A user with username ${dto.username} already exists`);
      }
    }

    if (!dto.createLogin) {
      const student = await this.prisma.student.create({
        data: {
          branchId,
          studentCode: dto.studentCode,
          name: dto.name,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          guardianName: dto.guardianName,
          guardianPhone: dto.guardianPhone,
        },
        include: this.includeClause(),
      });
      if (dto.halqaId) {
        await this.hifdh.generateInitialSchedulesForStudent(student.id, branchId, dto.halqaId, dto.hifdhStartDate);
      }
      return { student, loginCreated: false };
    }

    // User.firstName/lastName is a separate model from Student's single
    // `name` field — split for the login account only, mirroring
    // AdmissionsService's approve() convention.
    const [userFirstName, ...userLastNameParts] = dto.name.trim().split(/\s+/);
    const userLastName = userLastNameParts.join(' ') || userFirstName;

    const { student, temporaryPassword } = await this.prisma.$transaction(async (tx) => {
      const temporaryPassword = crypto.randomBytes(9).toString('base64url');
      const passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
      const user = await tx.user.create({
        data: {
          username: dto.username!,
          email: dto.email,
          passwordHash,
          firstName: userFirstName,
          lastName: userLastName,
          phone: dto.guardianPhone,
          branchId,
        },
      });

      const student = await tx.student.create({
        data: {
          branchId,
          studentCode: dto.studentCode,
          name: dto.name,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          guardianName: dto.guardianName,
          guardianPhone: dto.guardianPhone,
          userId: user.id,
        },
        include: this.includeClause(),
      });

      // Auto-assign the seeded "Student" role so the account is immediately
      // usable on the mobile app, mirroring TeachersService's convention.
      const studentRole = await tx.role.findUnique({ where: { name: 'Student' } });
      if (studentRole) {
        await tx.userRole.create({ data: { userId: user.id, roleId: studentRole.id } });
      }

      return { student, temporaryPassword };
    });

    // Outside the transaction, matching legacy: a schedule-generation failure
    // must never roll back or block student creation.
    if (dto.halqaId) {
      await this.hifdh.generateInitialSchedulesForStudent(student.id, branchId, dto.halqaId, dto.hifdhStartDate);
    }

    return {
      student,
      temporaryPassword,
      note: 'Share this one-time password with the student/guardian out-of-band. It is not stored or recoverable.',
    };
  }

  async update(branchId: string, id: string, dto: UpdateStudentDto) {
    await this.findOne(branchId, id);

    return this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.guardianName !== undefined && { guardianName: dto.guardianName }),
        ...(dto.guardianPhone !== undefined && { guardianPhone: dto.guardianPhone }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: this.includeClause(),
    });
  }

  /**
   * 'delete' removes only the Student row. Student.userId's FK has no
   * onDelete: Cascade configured on the Student side pointing to it being
   * deleted (onDelete governs what happens when the *referenced* User is
   * deleted, not the reverse) — so deleting a Student never touches its
   * linked User. Any portal login a student had remains intact, just
   * orphaned (no longer linked to a Student record). This is the safer
   * default: removing a student profile shouldn't silently destroy a
   * guardian/student's account credentials.
   */
  async bulkAction(branchId: string, dto: BulkActionDto) {
    const where = { branchId, id: { in: dto.ids } };

    if (dto.action === 'delete') {
      return this.prisma.student.deleteMany({ where });
    }

    return this.prisma.student.updateMany({
      where,
      data: { status: dto.action === 'activate' ? 'ACTIVE' : 'INACTIVE' },
    });
  }
}
