import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeacherApplicationDto } from './dto/create-teacher-application.dto';
import {
  RejectTeacherApplicationDto,
  ReviewTeacherApplicationDto,
} from './dto/review-teacher-application.dto';
import { MailService } from '../../mail/mail.service';

const SALT_ROUNDS = 10;

@Injectable()
export class TeacherApplicationsService {
  private readonly logger = new Logger(TeacherApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  list(branchId: string, status?: string) {
    return this.prisma.teacherApplication.findMany({
      where: { branchId, ...(status && { status: status as never }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.teacherApplication.findFirst({ where: { id, branchId } });
    if (!record) {
      throw new NotFoundException('Teacher application not found');
    }
    return record;
  }

  private slugifyUsername(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'user';
  }

  private async uniqueUsername(candidate: string): Promise<string> {
    let username = this.slugifyUsername(candidate);
    let suffix = 1;
    while (await this.prisma.user.findUnique({ where: { username } })) {
      suffix += 1;
      username = `${this.slugifyUsername(candidate)}_${suffix}`;
    }
    return username;
  }

  // No public application portal exists yet (Phase 2.6 territory) — this is
  // an authenticated admin-entry endpoint for now, not the applicant's own
  // public-facing submission form the old system had. Flagged as a known
  // scope gap, not an oversight.
  create(branchId: string, dto: CreateTeacherApplicationDto) {
    return this.prisma.teacherApplication.create({ data: { branchId, ...dto } });
  }

  /**
   * Approving an application provisions a REAL login: a new User + Teacher
   * record, transactionally, with a random one-time password returned in the
   * response body (never persisted in plaintext, never logged) for the admin
   * to hand off to the new teacher out-of-band. A proper invite-email flow
   * is Phase 2.6 territory ("notification/invite email flows" in the build
   * order) — this is the interim mechanism.
   */
  async approve(branchId: string, id: string, reviewerId: string, dto: ReviewTeacherApplicationDto) {
    const application = await this.findOne(branchId, id);
    if (application.status !== 'PENDING') {
      throw new ConflictException('Only a PENDING application can be approved');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: application.email },
    });
    if (existingUser) {
      throw new ConflictException(
        `A user with email ${application.email} already exists — cannot provision a duplicate account`,
      );
    }

    const temporaryPassword = crypto.randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
    const [firstName, ...rest] = application.fullName.trim().split(/\s+/);
    const lastName = rest.join(' ') || firstName;
    const username = await this.uniqueUsername(application.email.split('@')[0]);

    const { teacher } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          email: application.email,
          passwordHash,
          firstName,
          lastName,
          phone: application.phone,
          branchId,
        },
      });
      const teacher = await tx.teacher.create({
        data: { userId: user.id, branchId, status: 'ACTIVE' },
      });

      // Auto-assign the seeded "Teacher" role so the approved applicant can
      // actually use the system on first login, per product decision.
      const teacherRole = await tx.role.findUnique({ where: { name: 'Teacher' } });
      if (teacherRole) {
        await tx.userRole.create({ data: { userId: user.id, roleId: teacherRole.id } });
      }

      await tx.teacherApplication.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: reviewerId,
          reviewNote: dto.reviewNote,
          reviewedAt: new Date(),
          createdTeacherId: teacher.id,
        },
      });
      return { teacher };
    });

    // Fire-and-forget status email. application.email is required by the
    // model, but never let a mail failure break the approval response.
    this.mail
      .sendTeacherApplicationApproved(application.email, application.fullName)
      .catch((err) =>
        this.logger.error(`Failed to send teacher-application-approved email to ${application.email}`, err),
      );

    return {
      teacherId: teacher.id,
      temporaryPassword,
      note: 'Share this one-time password with the applicant out-of-band. It is not stored or recoverable.',
    };
  }

  async reject(branchId: string, id: string, reviewerId: string, dto: RejectTeacherApplicationDto) {
    const application = await this.findOne(branchId, id);
    if (application.status !== 'PENDING') {
      throw new ConflictException('Only a PENDING application can be rejected');
    }
    const updated = await this.prisma.teacherApplication.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: reviewerId,
        reviewNote: dto.reviewNote,
        reviewedAt: new Date(),
      },
    });

    // Fire-and-forget status email. application.email is required by the
    // model, but never let a mail failure break the rejection response.
    this.mail
      .sendTeacherApplicationRejected(application.email, application.fullName, dto.reviewNote)
      .catch((err) =>
        this.logger.error(`Failed to send teacher-application-rejected email to ${application.email}`, err),
      );

    return updated;
  }
}
