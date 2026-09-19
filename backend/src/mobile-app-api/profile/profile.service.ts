import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { EditProfileDto } from './dto/edit-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const SALT_ROUNDS = 10;

function splitName(name: string): { firstName: string; lastName?: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.length > 0 ? rest.join(' ') : undefined };
}

function toGender(gender?: 'male' | 'female'): Gender | undefined {
  if (!gender) return undefined;
  return gender === 'male' ? Gender.MALE : Gender.FEMALE;
}

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(branchId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { branchId, userId },
      include: { user: true, department: true, designation: true },
    });
    if (employee) {
      return {
        id: employee.user.id,
        name: [employee.user.firstName, employee.user.lastName]
          .filter(Boolean)
          .join(' '),
        email: employee.user.email,
        phone_number: employee.user.phone,
        image: employee.user.imageUrl,
        gender: employee.gender,
        address: employee.address,
        qualification: employee.qualification,
        date_of_birth: employee.dateOfBirth,
        department_id: employee.departmentId,
        department: employee.department?.name ?? null,
        designation_id: employee.designationId,
        designation: employee.designation?.name ?? null,
        joining_date: employee.dateOfJoining,
      };
    }

    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (student) {
      return {
        id: student.id,
        name: student.name,
        email: student.user?.email ?? null,
        phone_number: student.user?.phone ?? student.guardianPhone ?? null,
        image: student.user?.imageUrl ?? null,
        gender: student.gender,
        address: student.address,
        qualification: student.qualification,
        date_of_birth: student.dateOfBirth,
        department_id: null,
        department: null,
        designation_id: null,
        designation: null,
        joining_date: student.joiningDate,
        father_name: student.fatherName,
        mother_name: student.motherName,
        guardian_name: student.guardianName,
        mobile_2: student.mobile2,
        whatsapp: student.user?.whatsapp ?? null,
        blood_group: student.bloodGroup,
      };
    }

    throw new ForbiddenException(
      'No employee or student record linked to your account in this branch',
    );
  }

  async editProfile(
    branchId: string,
    userId: string,
    dto: EditProfileDto,
    image?: Express.Multer.File,
    publicBaseUrl?: string,
  ) {
    const existingEmailOwner = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmailOwner && existingEmailOwner.id !== userId) {
      throw new ConflictException('That email is already in use.');
    }

    const imageUrl = image
      ? `${publicBaseUrl}/uploads/avatars/${image.filename}`
      : undefined;

    const employee = await this.prisma.employee.findFirst({
      where: { branchId, userId },
    });
    if (employee) {
      const { firstName, lastName } = splitName(dto.name);
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName,
          lastName,
          email: dto.email,
          phone: dto.phone_number,
          ...(imageUrl && { imageUrl }),
        },
      });
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: {
          gender: toGender(dto.gender),
          address: dto.address,
          qualification: dto.qualification,
          dateOfBirth: dto.date_of_birth
            ? new Date(dto.date_of_birth)
            : undefined,
          dateOfJoining: dto.joining_date
            ? new Date(dto.joining_date)
            : undefined,
        },
      });
      return this.getProfile(branchId, userId);
    }

    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (student) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          email: dto.email,
          phone: dto.phone_number,
          ...(imageUrl && { imageUrl }),
          ...(dto.whatsapp !== undefined && { whatsapp: dto.whatsapp }),
        },
      });
      await this.prisma.student.update({
        where: { id: student.id },
        data: {
          name: dto.name,
          gender: toGender(dto.gender),
          address: dto.address,
          qualification: dto.qualification,
          dateOfBirth: dto.date_of_birth
            ? new Date(dto.date_of_birth)
            : undefined,
          joiningDate: dto.joining_date
            ? new Date(dto.joining_date)
            : undefined,
          ...(dto.father_name !== undefined && { fatherName: dto.father_name }),
          ...(dto.mother_name !== undefined && { motherName: dto.mother_name }),
          ...(dto.guardian_name !== undefined && { guardianName: dto.guardian_name }),
          ...(dto.father_name !== undefined &&
            dto.guardian_name === undefined && { guardianName: dto.father_name }),
          ...(dto.mobile_2 !== undefined && { mobile2: dto.mobile_2 }),
          ...(dto.blood_group !== undefined && { bloodGroup: dto.blood_group }),
        },
      });
      return this.getProfile(branchId, userId);
    }

    throw new ForbiddenException(
      'No employee or student record linked to your account in this branch',
    );
  }

  /** Self-service change-password — verifies the caller's current password
   *  before overwriting it, unlike the admin-initiated reset-password
   *  endpoints (which set a new password directly with no such check). */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const matches = await bcrypt.compare(
      dto.current_password,
      user.passwordHash,
    );
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.new_password, SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      // Force re-login everywhere else: a changed password shouldn't leave
      // other sessions/devices still logged in on the old one.
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
