import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MobileContextService } from '../common/mobile-context.service';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: MobileContextService,
  ) {}

  async getProfile(branchId: string, userId: string) {
    const employeeId = await this.context.resolveOwnEmployeeId(branchId, userId);
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true, department: true, designation: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return {
      id: employee.user.id,
      name: [employee.user.firstName, employee.user.lastName].filter(Boolean).join(' '),
      email: employee.user.email,
      phone_number: employee.user.phone,
      image: null, // placeholder: no avatar storage yet
      gender: employee.gender,
      department_id: employee.departmentId,
      department: employee.department?.name ?? null,
      designation_id: employee.designationId,
      designation: employee.designation?.name ?? null,
      joining_date: employee.dateOfJoining,
    };
  }
}
