import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { ApproveAdmissionDto, RejectAdmissionDto } from './dto/approve-admission.dto';
import { MailService } from '../../mail/mail.service';

const SALT_ROUNDS = 10;

@Injectable()
export class AdmissionsService {
  private readonly logger = new Logger(AdmissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  list(branchId: string, status?: string) {
    return this.prisma.admission.findMany({
      where: { branchId, ...(status && { status: status as never }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.admission.findFirst({ where: { id, branchId } });
    if (!record) {
      throw new NotFoundException('Admission not found');
    }
    return record;
  }

  async create(branchId: string, dto: CreateAdmissionDto) {
    if (dto.desiredClassId) {
      const cls = await this.prisma.academicClass.findFirst({
        where: { id: dto.desiredClassId, branchId },
      });
      if (!cls) {
        throw new BadRequestException('desiredClassId must belong to this branch');
      }
    }
    return this.prisma.admission.create({
      data: {
        branchId,
        applicantName: dto.applicantName,
        guardianName: dto.guardianName,
        email: dto.email,
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        desiredClassId: dto.desiredClassId,
      },
    });
  }

  /**
   * Approving an admission provisions a real Student record — and, only if
   * explicitly requested, a User login (most students are guardian-managed
   * with no portal account of their own, per the schema's design).
   */
  async approve(branchId: string, id: string, reviewerId: string, dto: ApproveAdmissionDto) {
    const admission = await this.findOne(branchId, id);
    if (admission.status !== 'PENDING') {
      throw new ConflictException('Only a PENDING admission can be approved');
    }

    const existingCode = await this.prisma.student.findFirst({
      where: { branchId, studentCode: dto.studentCode },
    });
    if (existingCode) {
      throw new ConflictException(`A student with code ${dto.studentCode} already exists in this branch`);
    }

    if (dto.createLogin) {
      if (!admission.email) {
        throw new BadRequestException('Cannot create a login: this admission has no email on file');
      }
      const existingUser = await this.prisma.user.findUnique({ where: { email: admission.email } });
      if (existingUser) {
        throw new ConflictException(`A user with email ${admission.email} already exists`);
      }
    }

    const [firstName, ...rest] = admission.applicantName.trim().split(/\s+/);
    const lastName = rest.join(' ') || firstName;

    const { student, temporaryPassword } = await this.prisma.$transaction(async (tx) => {
      let userId: string | undefined;
      let temporaryPassword: string | undefined;

      if (dto.createLogin) {
        temporaryPassword = crypto.randomBytes(9).toString('base64url');
        const passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
        const user = await tx.user.create({
          data: {
            email: admission.email!,
            passwordHash,
            firstName,
            lastName,
            phone: admission.phone,
            branchId,
          },
        });
        userId = user.id;
      }

      const student = await tx.student.create({
        data: {
          branchId,
          studentCode: dto.studentCode,
          firstName,
          lastName,
          dateOfBirth: admission.dateOfBirth,
          guardianName: admission.guardianName,
          guardianPhone: admission.phone,
          admissionId: admission.id,
          userId,
        },
      });

      await tx.admission.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: reviewerId,
          reviewNote: dto.reviewNote,
          reviewedAt: new Date(),
          createdStudentId: student.id,
        },
      });

      return { student, temporaryPassword };
    });

    // Fire-and-forget status email: skip silently if there's no email on
    // file (admission.email is nullable). Never let a mail failure break
    // the approval response.
    if (admission.email) {
      this.mail
        .sendAdmissionApproved(admission.email, admission.applicantName, dto.studentCode)
        .catch((err) =>
          this.logger.error(`Failed to send admission-approved email to ${admission.email}`, err),
        );
    }

    return {
      studentId: student.id,
      loginCreated: Boolean(dto.createLogin),
      ...(temporaryPassword && {
        temporaryPassword,
        note: 'Share this one-time password with the student/guardian out-of-band. It is not stored or recoverable.',
      }),
    };
  }

  async reject(branchId: string, id: string, reviewerId: string, dto: RejectAdmissionDto) {
    const admission = await this.findOne(branchId, id);
    if (admission.status !== 'PENDING') {
      throw new ConflictException('Only a PENDING admission can be rejected');
    }
    const updated = await this.prisma.admission.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: reviewerId,
        reviewNote: dto.reviewNote,
        reviewedAt: new Date(),
      },
    });

    // Fire-and-forget status email: skip silently if there's no email on
    // file (admission.email is nullable). Never let a mail failure break
    // the rejection response.
    if (admission.email) {
      this.mail
        .sendAdmissionRejected(admission.email, admission.applicantName, dto.reviewNote)
        .catch((err) =>
          this.logger.error(`Failed to send admission-rejected email to ${admission.email}`, err),
        );
    }

    return updated;
  }
}
