import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Gender } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EditProfileDto } from './dto/edit-profile.dto';

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
        name: [employee.user.firstName, employee.user.lastName].filter(Boolean).join(' '),
        email: employee.user.email,
        phone_number: employee.user.phone,
        image: null, // placeholder: no avatar storage yet
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
        image: null, // placeholder: no avatar storage yet
        gender: student.gender,
        address: student.address,
        qualification: student.qualification,
        date_of_birth: student.dateOfBirth,
        department_id: null,
        department: null,
        designation_id: null,
        designation: null,
        joining_date: student.joiningDate,
      };
    }

    throw new ForbiddenException('No employee or student record linked to your account in this branch');
  }

  async editProfile(branchId: string, userId: string, dto: EditProfileDto) {
    const existingEmailOwner = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingEmailOwner && existingEmailOwner.id !== userId) {
      throw new ConflictException('That email is already in use.');
    }

    const employee = await this.prisma.employee.findFirst({ where: { branchId, userId } });
    if (employee) {
      const { firstName, lastName } = splitName(dto.name);
      await this.prisma.user.update({
        where: { id: userId },
        data: { firstName, lastName, email: dto.email, phone: dto.phone_number },
      });
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: {
          gender: toGender(dto.gender),
          address: dto.address,
          qualification: dto.qualification,
          dateOfBirth: dto.date_of_birth ? new Date(dto.date_of_birth) : undefined,
          dateOfJoining: dto.joining_date ? new Date(dto.joining_date) : undefined,
        },
      });
      return this.getProfile(branchId, userId);
    }

    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (student) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { email: dto.email, phone: dto.phone_number },
      });
      await this.prisma.student.update({
        where: { id: student.id },
        data: {
          name: dto.name,
          gender: toGender(dto.gender),
          address: dto.address,
          qualification: dto.qualification,
          dateOfBirth: dto.date_of_birth ? new Date(dto.date_of_birth) : undefined,
          joiningDate: dto.joining_date ? new Date(dto.joining_date) : undefined,
        },
      });
      return this.getProfile(branchId, userId);
    }

    throw new ForbiddenException('No employee or student record linked to your account in this branch');
  }
}
