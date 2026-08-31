import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { BulkActionDto } from '../../common/dto/bulk-action.dto';
import { MailService } from '../../mail/mail.service';
import type { EmployeeImportRow } from './employees.import';

const SALT_ROUNDS = 10;
const IMPORT_DEFAULT_PASSWORD = 'Welcome123!';

function splitName(name: string): { firstName: string; lastName?: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.length > 0 ? rest.join(' ') : undefined };
}

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
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        whatsapp: true,
        isActive: true,
      },
    };
  }

  private async assertUsernameAvailable(username: string) {
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new ConflictException('That username is already taken.');
    }
  }

  /** Next "EMP###" code for this branch, used when the caller doesn't supply one. */
  private async nextEmployeeCode(branchId: string): Promise<string> {
    const employees = await this.prisma.employee.findMany({
      where: { branchId },
      select: { employeeCode: true },
    });
    const maxNumber = employees.reduce((max, e) => {
      const match = /^EMP(\d+)$/i.exec(e.employeeCode);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `EMP${String(maxNumber + 1).padStart(3, '0')}`;
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
    await this.assertUsernameAvailable(dto.username);
    await this.assertDepartmentAndDesignationBelongToBranch(
      branchId,
      dto.departmentId,
      dto.designationId,
    );

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const employeeCode = dto.employeeCode ?? (await this.nextEmployeeCode(branchId));
    const { firstName, lastName } = splitName(dto.name);
    const employeeType = dto.employeeType ?? 'OFFICE_STAFF';

    const employee = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          passwordHash,
          firstName,
          lastName,
          phone: dto.phone,
          whatsapp: dto.whatsapp,
          branchId,
        },
      });

      const created = await tx.employee.create({
        data: {
          userId: user.id,
          branchId,
          employeeCode,
          employeeType,
          departmentId: dto.departmentId,
          designationId: dto.designationId,
          dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : undefined,
        },
        include: this.includeClause(),
      });

      // A Teacher-type employee gets a linked Teacher record on the same
      // login, so they also appear in the Teachers list/academic modules —
      // Teachers are no longer created standalone (see TeachersService).
      if (employeeType === 'TEACHER') {
        const teacherRole = await tx.role.findUnique({ where: { name: 'Teacher' } });
        await tx.teacher.create({
          data: { userId: user.id, branchId, employeeId: created.id, employeeCode },
        });
        if (teacherRole) {
          await tx.userRole.create({ data: { userId: user.id, roleId: teacherRole.id } });
        }
      }

      return created;
    });

    // Fire-and-forget invite email: employees provisioned here don't get a
    // generated one-time password (unlike Teachers/Admissions createLogin
    // flows), so this is a plain welcome notice. Never let a mail failure
    // break the employee-creation response. Skipped entirely when no email
    // was provided (email is optional now that login uses username).
    if (dto.email) {
      this.mail
        .sendEmployeeInvite(dto.email, firstName)
        .catch((err) => this.logger.error(`Failed to send employee invite email to ${dto.email}`, err));
    }

    return employee;
  }

  async update(branchId: string, id: string, dto: UpdateEmployeeDto) {
    const existing = await this.findOne(branchId, id);
    await this.assertDepartmentAndDesignationBelongToBranch(
      branchId,
      dto.departmentId,
      dto.designationId,
    );

    return this.prisma.$transaction(async (tx) => {
      if (dto.password) {
        const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
        await tx.user.update({ where: { id: existing.userId }, data: { passwordHash } });
      }

      return tx.employee.update({
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
    });
  }

/** Slugifies a name into a username candidate: "Muhammed Ibrahim" -> "muhammed.ibrahim". */
  private slugifyUsername(name: string): string {
    return (
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '') || 'user'
    );
  }

  private async uniqueUsername(candidate: string): Promise<string> {
    let username = candidate;
    let suffix = 1;
    while (await this.prisma.user.findUnique({ where: { username } })) {
      suffix += 1;
      username = `${candidate}_${suffix}`;
    }
    return username;
  }

  /**
   * Bulk-imports parsed spreadsheet rows for this branch. Rows whose email
   * or generated username collides with an existing account are skipped
   * (reported back) rather than failing the whole import. Imported accounts
   * get a shared default password ("Welcome123!") since the source data has
   * no password column — same fallback approach as the legacy bulk importer.
   */
  async importRows(branchId: string, rows: EmployeeImportRow[]) {
    const passwordHash = await bcrypt.hash(IMPORT_DEFAULT_PASSWORD, SALT_ROUNDS);
    let imported = 0;
    const skipped: string[] = [];

    for (const row of rows) {
      const [firstName, ...rest] = row.name.split(/\s+/);
      const lastName = rest.length > 0 ? rest.join(' ') : undefined;

      if (row.email) {
        const existingByEmail = await this.prisma.user.findUnique({ where: { email: row.email } });
        if (existingByEmail) {
          skipped.push(`${row.name} (email already exists: ${row.email})`);
          continue;
        }
      }

      if (row.employeeCode) {
        const existingByCode = await this.prisma.employee.findFirst({
          where: { branchId, employeeCode: row.employeeCode },
        });
        if (existingByCode) {
          skipped.push(`${row.name} (employee code already exists: ${row.employeeCode})`);
          continue;
        }
      }

      const usernameCandidate = row.email ? row.email.split('@')[0] : this.slugifyUsername(row.name);
      const username = await this.uniqueUsername(this.slugifyUsername(usernameCandidate));
      const employeeCode = row.employeeCode ?? (await this.nextEmployeeCode(branchId));

      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username,
            email: row.email ?? undefined,
            passwordHash,
            firstName,
            lastName,
            isActive: row.isActive,
            branchId,
          },
        });
        await tx.employee.create({
          data: {
            userId: user.id,
            branchId,
            employeeCode,
            dateOfJoining: row.joiningDate ? new Date(row.joiningDate) : undefined,
            status: row.isActive ? 'ACTIVE' : 'INACTIVE',
          },
        });
      });
      imported++;
    }

    return { imported, skipped: skipped.length, skippedDetails: skipped };
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
