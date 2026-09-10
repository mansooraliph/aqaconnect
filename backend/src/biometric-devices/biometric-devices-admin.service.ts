import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService, UserAccessContext } from '../rbac/access-control.service';
import { INFO_COMMAND, REBOOT_COMMAND } from '../common/biometric/device-commands.util';
import { BulkActionResult, ListCommandsQueryDto, ListDevicesQueryDto } from './dto/biometric-device-admin.dto';

function page(q: { page?: string; per_page?: string }) {
  const pageNum = Math.max(1, Number(q.page) || 1);
  const perPage = Math.min(200, Math.max(1, Number(q.per_page) || 20));
  return { pageNum, perPage, skip: (pageNum - 1) * perPage, take: perPage };
}

function meta(total: number, pageNum: number, perPage: number) {
  return { current_page: pageNum, per_page: perPage, total, last_page: Math.max(1, Math.ceil(total / perPage)) };
}

/**
 * Manages the shared pool of biometric devices before/across branch
 * assignment. In smartjamia this was a dedicated superadmin app; here it's
 * just another RBAC-permissioned resource — any user holding
 * `devices.biometric_devices.manage` can assign/approve/manage devices.
 * Since that permission is also granted to the branch-scoped "Branch Admin"
 * role (not just GLOBAL roles), and most of these routes target a device by
 * id rather than by branchId (so BranchScopeGuard can't check them), this
 * service re-derives branch ownership itself: a non-global caller may only
 * mutate a device that's unassigned or already assigned to one of their
 * branches.
 */
@Injectable()
export class BiometricDevicesAdminService {
  private readonly logger = new Logger(BiometricDevicesAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  /** Non-global callers may only act on devices unassigned or in their own branch(es). */
  private assertCanActOn(accessContext: UserAccessContext, device: { branchId: string | null }): void {
    if (accessContext.isGlobal) return;
    if (device.branchId && !this.accessControl.canAccessBranch(accessContext, device.branchId)) {
      throw new ForbiddenException('You do not have access to this device’s branch');
    }
  }

  async list(q: ListDevicesQueryDto, accessContext: UserAccessContext) {
    const { pageNum, perPage, skip, take } = page(q);
    const where: Prisma.BiometricDeviceWhereInput = {
      ...(q.branchId && { branchId: q.branchId }),
      ...(q.isApproved !== undefined && { isApproved: q.isApproved }),
      ...(q.isAssigned !== undefined && { branchId: q.isAssigned ? { not: null } : null }),
      ...(q.search && {
        OR: [{ sn: { contains: q.search, mode: 'insensitive' } }, { alias: { contains: q.search, mode: 'insensitive' } }],
      }),
      // Non-global callers see only the shared unassigned pool + their own branches' devices.
      ...(!accessContext.isGlobal && {
        OR: [{ branchId: null }, { branchId: { in: [...accessContext.allowedBranchIds] } }],
      }),
    };
    const [total, items] = await Promise.all([
      this.prisma.biometricDevice.count({ where }),
      this.prisma.biometricDevice.findMany({
        where,
        include: { branch: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { data: items, meta: meta(total, pageNum, perPage) };
  }

  async findOne(id: string) {
    const d = await this.prisma.biometricDevice.findUnique({
      where: { id },
      include: { branch: { select: { id: true, name: true, code: true } } },
    });
    if (!d) throw new NotFoundException('Device not found');
    return d;
  }

  unassigned() {
    return this.prisma.biometricDevice.findMany({ where: { branchId: null }, orderBy: { createdAt: 'desc' } });
  }

  /** Assigning targets dto.branchId, already checked by BranchScopeGuard at the controller. */
  async assignToBranch(id: string, branchId: string, userId?: string) {
    await this.findOne(id);
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    return this.prisma.biometricDevice.update({
      where: { id },
      data: { branchId, assignedAt: new Date(), assignedByUserId: userId ?? null },
    });
  }

  async unassign(id: string, accessContext: UserAccessContext) {
    const device = await this.findOne(id);
    this.assertCanActOn(accessContext, device);
    return this.prisma.biometricDevice.update({
      where: { id },
      data: { branchId: null, assignedAt: null, assignedByUserId: null },
    });
  }

  async approve(id: string, userId: string | undefined, accessContext: UserAccessContext) {
    const device = await this.findOne(id);
    this.assertCanActOn(accessContext, device);
    return this.prisma.biometricDevice.update({
      where: { id },
      data: { isApproved: true, approvedByUserId: userId ?? null, approvedAt: new Date() },
    });
  }

  async deactivate(id: string, userId: string | undefined, reason: string, accessContext: UserAccessContext) {
    const device = await this.findOne(id);
    this.assertCanActOn(accessContext, device);
    return this.prisma.biometricDevice.update({
      where: { id },
      data: { deactivatedAt: new Date(), deactivatedByUserId: userId ?? null, deactivationReason: reason },
    });
  }

  async reactivate(id: string, accessContext: UserAccessContext) {
    const device = await this.findOne(id);
    this.assertCanActOn(accessContext, device);
    return this.prisma.biometricDevice.update({
      where: { id },
      data: { deactivatedAt: null, deactivatedByUserId: null, deactivationReason: null },
    });
  }

  async remove(id: string, accessContext: UserAccessContext) {
    const device = await this.findOne(id);
    this.assertCanActOn(accessContext, device);
    await this.prisma.biometricDevice.delete({ where: { id } });
    return { deleted: true, id };
  }

  /** Queue a reboot command for the device. */
  async queueRestart(id: string, userId: string | undefined, accessContext: UserAccessContext) {
    const device = await this.findOne(id);
    this.assertCanActOn(accessContext, device);
    await this.prisma.biometricDeviceCommand.create({
      data: { sn: device.sn, branchId: device.branchId, command: REBOOT_COMMAND, status: 0, createdByUserId: userId ?? null },
    });
    return { queued: true, sn: device.sn };
  }

  /** Ask the device to report its info/stats (handled on next devicecmd). */
  async queueSync(id: string, userId: string | undefined, accessContext: UserAccessContext) {
    const device = await this.findOne(id);
    this.assertCanActOn(accessContext, device);
    await this.prisma.biometricDeviceCommand.create({
      data: { sn: device.sn, branchId: device.branchId, command: INFO_COMMAND, status: 0, createdByUserId: userId ?? null },
    });
    return { queued: true, sn: device.sn };
  }

  /** Read device info — alias of queueSync, exposed as its own endpoint. */
  readInfo(id: string, userId: string | undefined, accessContext: UserAccessContext) {
    return this.queueSync(id, userId, accessContext);
  }

  // ── Bulk actions ────────────────────────────────────────────────────────────

  bulkRestart(deviceIds: string[], userId: string | undefined, accessContext: UserAccessContext): Promise<BulkActionResult> {
    return this.runBulk(deviceIds, REBOOT_COMMAND, userId, accessContext);
  }

  bulkReadInfo(deviceIds: string[], userId: string | undefined, accessContext: UserAccessContext): Promise<BulkActionResult> {
    return this.runBulk(deviceIds, INFO_COMMAND, userId, accessContext);
  }

  /**
   * Queue a command to many devices by id. Deactivated devices, and (for
   * non-global callers) devices outside their branches, are skipped; a
   * per-device failure never stops the rest.
   */
  private async runBulk(
    deviceIds: string[],
    command: string,
    userId: string | undefined,
    accessContext: UserAccessContext,
  ): Promise<BulkActionResult> {
    const devices = await this.prisma.biometricDevice.findMany({ where: { id: { in: deviceIds } } });
    const label = (d: { alias: string | null; sn: string }) => d.alias || d.sn;
    const rows: Prisma.BiometricDeviceCommandCreateManyInput[] = [];
    const failed: string[] = [];

    for (const device of devices) {
      if (device.deactivatedAt) {
        this.logger.warn(`Skipping deactivated device ${label(device)}`);
        failed.push(label(device));
        continue;
      }
      if (!accessContext.isGlobal && device.branchId && !this.accessControl.canAccessBranch(accessContext, device.branchId)) {
        failed.push(label(device));
        continue;
      }
      rows.push({ sn: device.sn, branchId: device.branchId, command, status: 0, createdByUserId: userId ?? null });
    }

    try {
      if (rows.length) await this.prisma.biometricDeviceCommand.createMany({ data: rows });
    } catch (err) {
      this.logger.error(`Bulk insert failed: ${(err as Error).message}`);
      return { success_count: 0, failed_count: deviceIds.length, failed_devices: devices.map(label), message: 'Failed to queue commands' };
    }

    const successCount = rows.length;
    const parts = [`Command queued on ${successCount} device(s)`];
    if (failed.length) parts.push(`${failed.length} failed`);
    return { success_count: successCount, failed_count: failed.length, failed_devices: failed, message: parts.join(', ') };
  }

  async listCommands(q: ListCommandsQueryDto) {
    const { pageNum, perPage, skip, take } = page(q);
    const where: Prisma.BiometricDeviceCommandWhereInput = {
      ...(q.sn && { sn: q.sn }),
      ...(q.status !== undefined && { status: q.status }),
    };
    const [total, items] = await Promise.all([
      this.prisma.biometricDeviceCommand.count({ where }),
      this.prisma.biometricDeviceCommand.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    ]);
    return { data: items, meta: meta(total, pageNum, perPage) };
  }

  async deviceCommands(id: string) {
    const device = await this.findOne(id);
    return this.prisma.biometricDeviceCommand.findMany({ where: { sn: device.sn }, orderBy: { createdAt: 'desc' }, take: 50 });
  }
}
