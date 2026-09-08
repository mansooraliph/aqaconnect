import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ResetStudentPasswordDto } from './dto/reset-student-password.dto';
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

  async resetPassword(branchId: string, id: string, dto: ResetStudentPasswordDto) {
    const student = await this.prisma.student.findFirst({ where: { id, branchId } });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (!student.userId) {
      throw new BadRequestException('This student has no login account to reset a password for');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: student.userId }, data: { passwordHash } }),
      // Force re-login everywhere: a reset password shouldn't leave old sessions valid.
      this.prisma.refreshToken.updateMany({
        where: { userId: student.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  /**
   * Direct student creation, bypassing the Admission workflow. Student.userId
   * is nullable — most students are guardian-managed with no portal account
   * of their own — so a login is only provisioned when `createLogin` is
   * explicitly requested, with an auto-generated password, mirroring
   * AdmissionsService.approve's pattern for consistency.
   */
  private async nextStudentCode(branchId: string): Promise<string> {
    const students = await this.prisma.student.findMany({
      where: { branchId },
      select: { studentCode: true },
    });
    const maxNumber = students.reduce((max, s) => {
      const match = /^STU(\d+)$/i.exec(s.studentCode);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `STU${String(maxNumber + 1).padStart(3, '0')}`;
  }

  async create(branchId: string, dto: CreateStudentDto) {
    const studentCode = dto.studentCode ?? (await this.nextStudentCode(branchId));

    const existingCode = await this.prisma.student.findFirst({
      where: { branchId, studentCode },
    });
    if (existingCode) {
      throw new ConflictException(`A student with code ${studentCode} already exists in this branch`);
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
          studentCode,
          name: dto.name,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          guardianName: dto.guardianName,
          guardianPhone: dto.guardianPhone,
          // Persisted regardless of Halqa assignment — generateInitialSchedulesForStudent
          // below only consumes it transiently (requires halqaId), so without this the
          // value would otherwise be silently dropped when no Halqa is picked yet.
          hifdhStartDate: dto.hifdhStartDate ? new Date(dto.hifdhStartDate) : undefined,
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

    // A client-supplied password is used as-is; otherwise one is generated
    // and returned to the caller as before.
    const temporaryPassword = dto.password ?? crypto.randomBytes(9).toString('base64url');

    const { student } = await this.prisma.$transaction(async (tx) => {
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
          studentCode,
          name: dto.name,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          guardianName: dto.guardianName,
          guardianPhone: dto.guardianPhone,
          hifdhStartDate: dto.hifdhStartDate ? new Date(dto.hifdhStartDate) : undefined,
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

      return { student };
    });

    // Outside the transaction, matching legacy: a schedule-generation failure
    // must never roll back or block student creation.
    if (dto.halqaId) {
      await this.hifdh.generateInitialSchedulesForStudent(student.id, branchId, dto.halqaId, dto.hifdhStartDate);
    }

    return {
      student,
      temporaryPassword,
      note: dto.password
        ? 'Login created with the password you provided.'
        : 'Share this one-time password with the student/guardian out-of-band. It is not stored or recoverable.',
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
