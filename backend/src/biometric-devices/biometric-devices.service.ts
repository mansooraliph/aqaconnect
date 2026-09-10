import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BiometricTemplateType, BiometricTransaction, BiometricUserType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IclockService } from './iclock.service';
import {
  BIO_TYPE_LABEL,
  buildAddUserCommand,
  buildEnrollCommand,
  buildSetDuplicatePunchCommand,
  CLEAR_LOG_COMMAND,
  INFO_COMMAND,
  REBOOT_COMMAND,
} from '../common/biometric/device-commands.util';
import { getBiometricStatusMap } from '../common/biometric/biometric-status.util';
import {
  PrefixConfig,
  buildUserCode,
  loadBiometricPrefixes,
  prefixesFromSettings,
  sanitizePrefixes,
  validatePrefixes,
} from '../common/biometric/user-code.util';
import { ListEnrollmentsQueryDto, ListTransactionsQueryDto } from './dto/biometric-query.dto';
import {
  BiometricType,
  BulkActionResult,
  BulkEnrollDto,
  EnrollRemotelyDto,
  EnrollUserDto,
  EnrollUserType,
} from './dto/device-actions.dto';

export interface EnrollableUser {
  id: string;
  userType: EnrollUserType;
  code: string; // base identifier (studentCode / employeeCode)
  userCode: string; // full device PIN (prefix + base)
  name: string;
  subtitle?: string;
  enrollmentStatus: 'enrolled' | 'pending' | 'none';
}

function page(q: { page?: string; per_page?: string }) {
  const pageNum = Math.max(1, Number(q.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(q.per_page) || 20));
  return { pageNum, perPage, skip: (pageNum - 1) * perPage, take: perPage };
}

function meta(total: number, pageNum: number, perPage: number) {
  return { current_page: pageNum, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) };
}

@Injectable()
export class BiometricDevicesService {
  private readonly logger = new Logger(BiometricDevicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly iclock: IclockService,
  ) {}

  // ── Device settings: configurable PIN prefixes per branch ───────────────────

  async getDeviceSettings(branchId: string): Promise<{ prefixes: PrefixConfig }> {
    const settings = await this.prisma.branchSettings.findUnique({
      where: { branchId },
      select: { biometricPrefixes: true },
    });
    return { prefixes: prefixesFromSettings(settings?.biometricPrefixes) };
  }

  async updateDeviceSettings(
    branchId: string,
    prefixesInput: Partial<PrefixConfig>,
  ): Promise<{ prefixes: PrefixConfig }> {
    const prefixes = sanitizePrefixes(prefixesInput);
    const error = validatePrefixes(prefixes);
    if (error) throw new BadRequestException(error);

    await this.prisma.branchSettings.upsert({
      where: { branchId },
      create: { branchId, biometricPrefixes: prefixes as unknown as Prisma.InputJsonValue },
      update: { biometricPrefixes: prefixes as unknown as Prisma.InputJsonValue },
    });
    return { prefixes };
  }

  // ── Devices (scoped to this branch) ─────────────────────────────────────────

  listDevices(branchId: string) {
    return this.prisma.biometricDevice.findMany({ where: { branchId }, orderBy: { createdAt: 'desc' } });
  }

  async findDevice(branchId: string, id: string) {
    const d = await this.prisma.biometricDevice.findFirst({ where: { id, branchId } });
    if (!d) throw new NotFoundException('Device not found');
    return d;
  }

  async updateAlias(branchId: string, id: string, alias: string) {
    await this.findDevice(branchId, id);
    return this.prisma.biometricDevice.update({ where: { id }, data: { alias } });
  }

  // ── Device actions (single) ─────────────────────────────────────────────────

  async restartDevice(branchId: string, id: string, userId?: string) {
    const device = await this.findDevice(branchId, id);
    if (device.deactivatedAt) throw new BadRequestException('Device is deactivated');
    await this.iclock.queueDeviceCommand(branchId, REBOOT_COMMAND, undefined, device.sn, userId);
    return { message: `Restart command queued for ${this.label(device)}` };
  }

  async readDeviceInfo(branchId: string, id: string, userId?: string) {
    const device = await this.findDevice(branchId, id);
    await this.iclock.queueDeviceCommand(branchId, INFO_COMMAND, undefined, device.sn, userId);
    return { message: `Info request queued for ${this.label(device)}` };
  }

  async setDuplicatePunch(branchId: string, id: string, seconds: number, userId?: string) {
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) {
      throw new BadRequestException('seconds must be an integer between 0 and 3600');
    }
    const device = await this.findDevice(branchId, id);
    await this.iclock.queueDeviceCommand(
      branchId,
      buildSetDuplicatePunchCommand(seconds),
      undefined,
      device.sn,
      userId,
    );
    await this.prisma.biometricDevice.update({ where: { id: device.id }, data: { transferInterval: seconds } });
    return { message: `Duplicate punch interval set to ${seconds}s on ${this.label(device)}` };
  }

  async enrollRemotely(branchId: string, id: string, dto: EnrollRemotelyDto, userId?: string) {
    const device = await this.findDevice(branchId, id);
    const resolved = await this.resolveRawUserCode(branchId, dto.userCode);
    if (!resolved) throw new NotFoundException('User not found in this branch');
    await this.iclock.queueDeviceCommand(
      branchId,
      buildAddUserCommand(resolved.userCode, resolved.name),
      undefined,
      device.sn,
      userId,
    );
    await this.iclock.queueDeviceCommand(
      branchId,
      buildEnrollCommand(resolved.userCode, dto.biometricType, dto.fingerId),
      undefined,
      device.sn,
      userId,
    );
    return { message: `Enrollment command queued on ${this.label(device)}` };
  }

  // ── Device actions (bulk) ───────────────────────────────────────────────────

  bulkRestart(deviceIds: string[], branchId: string, userId?: string) {
    return this.runBulk(deviceIds, branchId, REBOOT_COMMAND, userId);
  }

  bulkReadInfo(deviceIds: string[], branchId: string, userId?: string) {
    return this.runBulk(deviceIds, branchId, INFO_COMMAND, userId);
  }

  async bulkSetDuplicatePunch(deviceIds: string[], branchId: string, seconds: number, userId?: string) {
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) {
      throw new BadRequestException('seconds must be an integer between 0 and 3600');
    }
    return this.runBulk(deviceIds, branchId, buildSetDuplicatePunchCommand(seconds), userId, (successIds) =>
      this.prisma.biometricDevice.updateMany({ where: { id: { in: successIds } }, data: { transferInterval: seconds } }),
    );
  }

  async bulkEnrollRemotely(deviceIds: string[], branchId: string, dto: BulkEnrollDto, userId?: string) {
    const resolved = await this.resolveRawUserCode(branchId, dto.userCode);
    if (!resolved) throw new NotFoundException('User not found in this branch');
    const commands = [
      buildAddUserCommand(resolved.userCode, resolved.name),
      buildEnrollCommand(resolved.userCode, dto.biometricType, dto.fingerId),
    ];
    return this.runBulk(deviceIds, branchId, commands, userId);
  }

  /**
   * Shared engine for bulk device actions: loads scoped devices, skips
   * deactivated ones, queues the command per device, and never lets one
   * failure stop the others.
   */
  private async runBulk(
    deviceIds: string[],
    branchId: string,
    command: string | string[],
    userId?: string,
    afterSuccess?: (successIds: string[]) => Promise<unknown>,
  ): Promise<BulkActionResult> {
    const commands = Array.isArray(command) ? command : [command];
    const devices = await this.prisma.biometricDevice.findMany({ where: { id: { in: deviceIds }, branchId } });
    const successIds: string[] = [];
    const failed: string[] = [];

    for (const device of devices) {
      if (device.deactivatedAt) {
        this.logger.warn(`Skipping deactivated device ${this.label(device)}`);
        failed.push(this.label(device));
        continue;
      }
      try {
        for (const cmd of commands) {
          await this.iclock.queueDeviceCommand(branchId, cmd, undefined, device.sn, userId);
        }
        successIds.push(device.id);
      } catch (err) {
        this.logger.error(`Bulk command failed for ${this.label(device)}: ${(err as Error).message}`);
        failed.push(this.label(device));
      }
    }

    if (afterSuccess && successIds.length) await afterSuccess(successIds).catch(() => undefined);

    const successCount = successIds.length;
    const failedCount = failed.length;
    const parts = [`Command queued on ${successCount} device(s)`];
    if (failedCount) parts.push(`${failedCount} failed`);
    return { success_count: successCount, failed_count: failedCount, failed_devices: failed, message: parts.join(', ') };
  }

  /**
   * Resolve a raw studentCode/employeeCode to its prefixed device PIN +
   * display name, or null if nothing matches. Used by enroll-by-code
   * endpoints so they emit prefixed PINs consistent with the rest of the
   * system.
   */
  private async resolveRawUserCode(
    branchId: string,
    rawCode: string,
  ): Promise<{ userCode: string; name: string } | null> {
    const prefixes = await loadBiometricPrefixes(this.prisma, branchId);
    const student = await this.prisma.student.findFirst({
      where: { branchId, studentCode: rawCode },
      select: { studentCode: true, name: true },
    });
    if (student) {
      return { userCode: buildUserCode(BiometricUserType.STUDENT, student.studentCode, prefixes), name: student.name };
    }
    const employee = await this.prisma.employee.findFirst({
      where: { branchId, employeeCode: rawCode },
      select: { employeeCode: true, employeeType: true, user: { select: { firstName: true, lastName: true } } },
    });
    if (employee) {
      const type = employee.employeeType === 'TEACHER' ? BiometricUserType.TEACHER : BiometricUserType.STAFF;
      const name = [employee.user.firstName, employee.user.lastName].filter(Boolean).join(' ');
      return { userCode: buildUserCode(type, employee.employeeCode, prefixes), name: name || employee.employeeCode };
    }
    return null;
  }

  private label(device: { alias: string | null; sn: string }): string {
    return device.alias || device.sn;
  }

  // ── User enrollment (students / employees) ──────────────────────────────────

  /** Search enrollable users of a given type, each resolved to its device PIN. */
  async listEnrollableUsers(branchId: string, type: EnrollUserType, search?: string): Promise<EnrollableUser[]> {
    const term = (search ?? '').trim();
    const prefixes = await loadBiometricPrefixes(this.prisma, branchId);

    if (type === 'student') {
      const rows = await this.prisma.student.findMany({
        where: {
          branchId,
          status: 'ACTIVE',
          ...(term
            ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { studentCode: { contains: term, mode: 'insensitive' } }] }
            : {}),
        },
        orderBy: { name: 'asc' },
        take: 20,
        select: { id: true, studentCode: true, name: true },
      });
      const statusById = await getBiometricStatusMap(this.prisma, branchId, 'studentId', rows.map((s) => s.id));
      return rows.map((s) => ({
        id: s.id,
        userType: 'student' as const,
        code: s.studentCode,
        userCode: buildUserCode(BiometricUserType.STUDENT, s.studentCode, prefixes),
        name: s.name,
        subtitle: s.studentCode,
        enrollmentStatus: statusById.get(s.id) ?? 'none',
      }));
    }

    const employeeTypeFilter: Prisma.EmployeeWhereInput['employeeType'] =
      type === 'teacher' ? 'TEACHER' : { in: ['ADMIN', 'OFFICE_STAFF'] };
    const rows = await this.prisma.employee.findMany({
      where: {
        branchId,
        status: 'ACTIVE',
        employeeType: employeeTypeFilter,
        ...(term
          ? {
              OR: [
                { employeeCode: { contains: term, mode: 'insensitive' } },
                { user: { firstName: { contains: term, mode: 'insensitive' } } },
                { user: { lastName: { contains: term, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { employeeCode: 'asc' },
      take: 20,
      select: { id: true, employeeCode: true, user: { select: { firstName: true, lastName: true } } },
    });
    const statusById = await getBiometricStatusMap(this.prisma, branchId, 'employeeId', rows.map((r) => r.id));
    return rows.map((r) => {
      const name = [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') || r.employeeCode;
      return {
        id: r.id,
        userType: type,
        code: r.employeeCode,
        userCode: buildUserCode(type === 'teacher' ? BiometricUserType.TEACHER : BiometricUserType.STAFF, r.employeeCode, prefixes),
        name,
        subtitle: r.employeeCode,
        enrollmentStatus: statusById.get(r.id) ?? 'none',
      };
    });
  }

  /** Resolve one enrollable user (by type + entity id) to its PIN + name. */
  private async resolveEnrollableUser(
    branchId: string,
    type: EnrollUserType,
    id: string,
  ): Promise<Omit<EnrollableUser, 'enrollmentStatus'> | null> {
    const prefixes = await loadBiometricPrefixes(this.prisma, branchId);
    if (type === 'student') {
      const s = await this.prisma.student.findFirst({ where: { id, branchId }, select: { id: true, studentCode: true, name: true } });
      if (!s) return null;
      return {
        id: s.id,
        userType: 'student',
        code: s.studentCode,
        userCode: buildUserCode(BiometricUserType.STUDENT, s.studentCode, prefixes),
        name: s.name,
        subtitle: s.studentCode,
      };
    }
    const e = await this.prisma.employee.findFirst({
      where: { id, branchId },
      select: { id: true, employeeCode: true, employeeType: true, user: { select: { firstName: true, lastName: true } } },
    });
    if (!e) return null;
    // Classify by employeeType so the prefix matches attendance resolution.
    const resolvedType: EnrollUserType = e.employeeType === 'TEACHER' ? 'teacher' : 'staff';
    const name = [e.user.firstName, e.user.lastName].filter(Boolean).join(' ') || e.employeeCode;
    return {
      id: e.id,
      userType: resolvedType,
      code: e.employeeCode,
      userCode: buildUserCode(resolvedType === 'teacher' ? BiometricUserType.TEACHER : BiometricUserType.STAFF, e.employeeCode, prefixes),
      name,
      subtitle: e.employeeCode,
    };
  }

  /**
   * Enroll a user onto the chosen devices: queues an add-user command plus
   * the biometric enroll command on each device, and records a pending
   * enrollment.
   */
  async enrollUser(branchId: string, dto: EnrollUserDto, requestedByUserId?: string): Promise<BulkActionResult> {
    const user = await this.resolveEnrollableUser(branchId, dto.userType, dto.userId);
    if (!user) throw new NotFoundException('User not found in this branch');

    const devices = await this.prisma.biometricDevice.findMany({ where: { id: { in: dto.deviceIds }, branchId } });
    if (!devices.length) throw new NotFoundException('No matching devices for this branch');

    const addUserCmd = buildAddUserCommand(user.userCode, user.name);
    const enrollCmd = buildEnrollCommand(user.userCode, dto.biometricType, dto.fingerId);

    const successIds: string[] = [];
    const failed: string[] = [];
    const addRows: Prisma.BiometricDeviceCommandCreateManyInput[] = [];
    const enrollRows: Prisma.BiometricDeviceCommandCreateManyInput[] = [];
    for (const device of devices) {
      if (device.deactivatedAt) {
        failed.push(this.label(device));
        continue;
      }
      addRows.push({ sn: device.sn, branchId, command: addUserCmd, status: 0, createdByUserId: requestedByUserId ?? null });
      enrollRows.push({ sn: device.sn, branchId, command: enrollCmd, status: 0, createdByUserId: requestedByUserId ?? null });
      successIds.push(device.id);
    }
    // Insert add-user commands FIRST (earlier created_at) so the device
    // creates the user before the enroll command runs — getrequest orders by seq.
    if (addRows.length) await this.prisma.biometricDeviceCommand.createMany({ data: addRows });
    if (enrollRows.length) await this.prisma.biometricDeviceCommand.createMany({ data: enrollRows });

    // Record a pending enrollment row (refreshed when the template arrives).
    const typeLabel = BIO_TYPE_LABEL[dto.biometricType];
    const index = dto.biometricType === 'fingerprint' ? String(dto.fingerId ?? 6) : '0';
    const firstSn = devices.find((d) => !d.deactivatedAt)?.sn ?? null;
    await this.prisma.biometricEnrollment.upsert({
      where: { branchId_userCode_type_index: { branchId, userCode: user.userCode, type: typeLabel, index } },
      create: {
        branchId,
        userCode: user.userCode,
        type: typeLabel,
        index,
        studentId: user.userType === 'student' ? user.id : null,
        employeeId: user.userType === 'teacher' || user.userType === 'staff' ? user.id : null,
        userType: user.userType.toUpperCase() as BiometricUserType,
        name: user.name,
        status: 'PENDING',
        deviceSn: firstSn,
      },
      update: {
        studentId: user.userType === 'student' ? user.id : null,
        employeeId: user.userType === 'teacher' || user.userType === 'staff' ? user.id : null,
        userType: user.userType.toUpperCase() as BiometricUserType,
        name: user.name,
        status: 'PENDING',
        deviceSn: firstSn,
      },
    });

    const parts = [`Enrollment queued for ${user.name} on ${successIds.length} device(s)`];
    if (failed.length) parts.push(`${failed.length} skipped (deactivated)`);
    return { success_count: successIds.length, failed_count: failed.length, failed_devices: failed, message: parts.join(', ') };
  }

  async clearData(branchId: string, id: string, userId?: string) {
    const device = await this.findDevice(branchId, id);
    await this.prisma.biometricDeviceCommand.create({
      data: { sn: device.sn, branchId, command: CLEAR_LOG_COMMAND, status: 0, createdByUserId: userId ?? null },
    });
    return { queued: true, sn: device.sn };
  }

  /**
   * Queue an arbitrary raw command to a device (manual / advanced tool). The
   * literal two-char sequence `\t` is converted to a real tab so users can
   * type tab-separated commands; CR/LF are stripped since one call = one
   * command.
   */
  async runManualCommand(branchId: string, id: string, rawCommand: string, userId?: string) {
    const device = await this.findDevice(branchId, id);
    const command = (rawCommand ?? '').replace(/\\t/g, '\t').replace(/[\r\n]/g, '').trim();
    if (!command) throw new BadRequestException('Command is empty');
    await this.prisma.biometricDeviceCommand.create({
      data: { sn: device.sn, branchId, command, status: 0, createdByUserId: userId ?? null },
    });
    return { queued: true, sn: device.sn, command };
  }

  /** Delete all still-pending (queued, not yet acked) commands for a device. */
  async clearPendingCommands(branchId: string, id: string) {
    const device = await this.findDevice(branchId, id);
    const res = await this.prisma.biometricDeviceCommand.deleteMany({ where: { sn: device.sn, status: 0 } });
    return { cleared: res.count, sn: device.sn };
  }

  async deviceCommands(branchId: string, id: string) {
    const device = await this.findDevice(branchId, id);
    return this.prisma.biometricDeviceCommand.findMany({ where: { sn: device.sn }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  /** Push all active students + employees to a device as DATA USER commands. */
  async syncUsers(branchId: string, id: string, userId?: string) {
    const device = await this.findDevice(branchId, id);
    const prefixes = await loadBiometricPrefixes(this.prisma, branchId);
    const students = await this.prisma.student.findMany({
      where: { branchId, status: 'ACTIVE' },
      select: { studentCode: true, name: true },
    });
    const employees = await this.prisma.employee.findMany({
      where: { branchId, status: 'ACTIVE' },
      select: { employeeCode: true, employeeType: true, user: { select: { firstName: true, lastName: true } } },
    });

    const commands: string[] = [];
    for (const s of students) {
      commands.push(buildAddUserCommand(buildUserCode(BiometricUserType.STUDENT, s.studentCode, prefixes), s.name));
    }
    for (const e of employees) {
      const type = e.employeeType === 'TEACHER' ? BiometricUserType.TEACHER : BiometricUserType.STAFF;
      const name = [e.user.firstName, e.user.lastName].filter(Boolean).join(' ') || e.employeeCode;
      commands.push(buildAddUserCommand(buildUserCode(type, e.employeeCode, prefixes), name));
    }

    if (!commands.length) throw new BadRequestException('No active students or employees to sync');
    await this.prisma.biometricDeviceCommand.createMany({
      data: commands.map((command) => ({ sn: device.sn, branchId, command, status: 0, createdByUserId: userId ?? null })),
    });
    return { queued: commands.length, sn: device.sn };
  }

  // ── Transactions / enrollments ───────────────────────────────────────────────

  private async attachTransactionDisplay(branchId: string, rows: BiometricTransaction[]) {
    const studentIds = [...new Set(rows.map((r) => r.studentId).filter(Boolean) as string[])];
    const employeeIds = [...new Set(rows.map((r) => r.employeeId).filter(Boolean) as string[])];
    const sns = [...new Set(rows.map((r) => r.deviceSn))];

    const [students, employees, devices] = await Promise.all([
      studentIds.length ? this.prisma.student.findMany({ where: { id: { in: studentIds }, branchId }, select: { id: true, name: true } }) : [],
      employeeIds.length
        ? this.prisma.employee.findMany({
            where: { id: { in: employeeIds }, branchId },
            select: { id: true, user: { select: { firstName: true, lastName: true } } },
          })
        : [],
      sns.length ? this.prisma.biometricDevice.findMany({ where: { sn: { in: sns }, branchId } }) : [],
    ]);
    const studentName = new Map(students.map((s): [string, string] => [s.id, s.name]));
    const employeeName = new Map(
      employees.map((e): [string, string] => [e.id, [e.user.firstName, e.user.lastName].filter(Boolean).join(' ')]),
    );
    const deviceAlias = new Map(devices.map((d): [string, string] => [d.sn, d.alias || d.sn]));

    return rows.map((r) => ({
      ...r,
      userName: (r.studentId && studentName.get(r.studentId)) || (r.employeeId && employeeName.get(r.employeeId)) || null,
      deviceAlias: deviceAlias.get(r.deviceSn) ?? r.deviceSn,
    }));
  }

  async transactions(branchId: string, q: ListTransactionsQueryDto) {
    const { pageNum, perPage, skip, take } = page(q);
    const where: Prisma.BiometricTransactionWhereInput = {
      branchId,
      ...(q.from || q.to ? { punchTime: { ...(q.from && { gte: new Date(q.from) }), ...(q.to && { lte: new Date(q.to) }) } } : {}),
      ...(q.studentId && { studentId: q.studentId }),
      ...(q.employeeId && { employeeId: q.employeeId }),
      ...(q.punchState !== undefined && { punchState: q.punchState }),
      ...(q.deviceSn && { deviceSn: q.deviceSn }),
      ...(q.userType && { userType: q.userType as BiometricUserType }),
    };
    const [total, items] = await Promise.all([
      this.prisma.biometricTransaction.count({ where }),
      this.prisma.biometricTransaction.findMany({ where, orderBy: { punchTime: 'desc' }, skip, take }),
    ]);
    const data = await this.attachTransactionDisplay(branchId, items);
    return { data, meta: meta(total, pageNum, perPage) };
  }

  private async attachEnrollmentDisplay<T extends { deviceSn: string | null }>(branchId: string, rows: T[]) {
    const sns = [...new Set(rows.map((r) => r.deviceSn).filter(Boolean) as string[])];
    const devices = sns.length ? await this.prisma.biometricDevice.findMany({ where: { sn: { in: sns }, branchId } }) : [];
    const deviceAlias = new Map(devices.map((d): [string, string] => [d.sn, d.alias || d.sn]));
    return rows.map((r) => ({ ...r, deviceAlias: r.deviceSn ? (deviceAlias.get(r.deviceSn) ?? r.deviceSn) : null }));
  }

  async enrollments(branchId: string, q: ListEnrollmentsQueryDto) {
    const { pageNum, perPage, skip, take } = page(q);
    const where: Prisma.BiometricEnrollmentWhereInput = {
      branchId,
      ...(q.type && { type: q.type as BiometricTemplateType }),
      ...(q.userCode && { userCode: q.userCode }),
      ...(q.userType && { userType: q.userType as BiometricUserType }),
      ...(q.studentId && { studentId: q.studentId }),
      ...(q.employeeId && { employeeId: q.employeeId }),
      ...(q.from || q.to ? { createdAt: { ...(q.from && { gte: new Date(q.from) }), ...(q.to && { lte: new Date(q.to) }) } } : {}),
      ...(q.search && {
        OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { userCode: { contains: q.search, mode: 'insensitive' } }],
      }),
    };
    const [total, items] = await Promise.all([
      this.prisma.biometricEnrollment.count({ where }),
      this.prisma.biometricEnrollment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          userCode: true,
          studentId: true,
          employeeId: true,
          userType: true,
          name: true,
          status: true,
          deviceSn: true,
          type: true,
          index: true,
          valid: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    const data = await this.attachEnrollmentDisplay(branchId, items);
    return { data, meta: meta(total, pageNum, perPage) };
  }

  async deleteTransaction(branchId: string, id: string) {
    const t = await this.prisma.biometricTransaction.findFirst({ where: { id, branchId } });
    if (!t) throw new NotFoundException('Transaction not found');
    await this.prisma.biometricTransaction.delete({ where: { id } });
    return { deleted: true, id };
  }

  async stats(branchId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [totalDevices, onlineDevices, txToday, enrolledUsers] = await Promise.all([
      this.prisma.biometricDevice.count({ where: { branchId } }),
      this.prisma.biometricDevice.count({ where: { branchId, state: '1' } }),
      this.prisma.biometricTransaction.count({ where: { branchId, punchTime: { gte: todayStart } } }),
      this.prisma.biometricEnrollment.findMany({ where: { branchId }, distinct: ['userCode'], select: { userCode: true } }),
    ]);
    return {
      total_devices: totalDevices,
      online_devices: onlineDevices,
      total_transactions_today: txToday,
      enrolled_users: enrolledUsers.length,
    };
  }
}
