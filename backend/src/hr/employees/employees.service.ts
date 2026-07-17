import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { BulkActionDto } from '../../common/dto/bulk-action.dto';
import { MailService } from '../../mail/mail.service';

const SALT_ROUNDS = 10;

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private userSelect() {
    return {
      select: {
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
      },
    };
  }

  private includeClause() {
    return {
      user: this.userSelect(),
      department: true,
      designation: true,
    };
  }

  list(branchId: string) {
    return this.prisma.employee.findMany({
      where: { branchId },
      include: this.includeClause(),
      orderBy: { employeeCode: 'asc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.employee.findFirst({
      where: { id, branchId },
      include: this.includeClause(),
    });
    if (!record) {
      throw new NotFoundException('Employee not found');
    }
    return record;
  }

  private async assertDepartmentAndDesignationBelongToBranch(
    branchId: string,
    departmentId?: string,
    designationId?: string,
  ) {
    if (departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: departmentId, branchId },
      });
      if (!department) {
        throw new BadRequestException('departmentId must belong to this branch');
      }
    }
    if (designationId) {
      const designation = await this.prisma.designation.findFirst({
        where: { id: designationId, branchId },
      });
      if (!designation) {
        throw new BadRequestException('designationId must belong to this branch');
      }
    }
  }

  async create(branchId: string, dto: CreateEmployeeDto) {
    await this.assertDepartmentAndDesignationBelongToBranch(
      branchId,
      dto.departmentId,
      dto.designationId,
    );

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const employee = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          branchId,
        },
      });

      return tx.employee.create({
        data: {
          userId: user.id,
          branchId,
          employeeCode: dto.employeeCode,
          departmentId: dto.departmentId,
          designationId: dto.designationId,
          dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : undefined,
        },
        include: this.includeClause(),
      });
    });

    // Fire-and-forget invite email: employees provisioned here don't get a
    // generated one-time password (unlike Teachers/Admissions createLogin
    // flows), so this is a plain welcome notice. Never let a mail failure
    // break the employee-creation response.
    this.mail
      .sendEmployeeInvite(dto.email, dto.firstName)
      .catch((err) => this.logger.error(`Failed to send employee invite email to ${dto.email}`, err));

    return employee;
  }

  async update(branchId: string, id: string, dto: UpdateEmployeeDto) {
    await this.findOne(branchId, id);
    await this.assertDepartmentAndDesignationBelongToBranch(
      branchId,
      dto.departmentId,
      dto.designationId,
    );

    return this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.employeeCode !== undefined && { employeeCode: dto.employeeCode }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.designationId !== undefined && { designationId: dto.designationId }),
        ...(dto.dateOfJoining !== undefined && { dateOfJoining: new Date(dto.dateOfJoining) }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: this.includeClause(),
    });
  }

  /**
   * 'delete' is implemented as a real cascade delete of Employee + User (not
   * a soft "skip"), matching the brief's option to actually remove the login
   * account along with the HR profile. Deleting the paired User is enough:
   * Employee.user has onDelete: Cascade, so the Employee row disappears too.
   */
  async bulkAction(branchId: string, dto: BulkActionDto) {
    const where = { branchId, id: { in: dto.ids } };

    if (dto.action === 'delete') {
      const employees = await this.prisma.employee.findMany({
        where,
        select: { userId: true },
      });
      const userIds = employees.map((e) => e.userId);
      return this.prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    return this.prisma.employee.updateMany({
      where,
      data: { status: dto.action === 'activate' ? 'ACTIVE' : 'INACTIVE' },
    });
  }
}
