import { BadRequestException, Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AccessControlService } from '../../rbac/access-control.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

const ADMIN_ROLE_NAMES = ['Super Admin', 'Branch Admin', 'Management'];

@Injectable()
export class MobileAnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly accessControl: AccessControlService,
  ) {}

  private async isAdminTier(userId: string): Promise<boolean> {
    const context = await this.accessControl.getUserAccessContext(userId);
    return context.roles.some((role) => ADMIN_ROLE_NAMES.includes(role.name));
  }

  async create(branchId: string, createdById: string, dto: CreateAnnouncementDto) {
    const isAdmin = await this.isAdminTier(createdById);

    if (isAdmin) {
      return this.createBranchWide(branchId, createdById, dto);
    }
    return this.createForOwnHalqa(branchId, createdById, dto);
  }

  private async createBranchWide(branchId: string, createdById: string, dto: CreateAnnouncementDto) {
    if (!dto.audience) {
      throw new BadRequestException('audience is required');
    }

    const targetHalqaIds = dto.audience === 'STUDENTS' ? (dto.halqaIds ?? []) : [];
    if (targetHalqaIds.length) {
      const matched = await this.prisma.halqa.count({ where: { id: { in: targetHalqaIds }, branchId } });
      if (matched !== targetHalqaIds.length) {
        throw new BadRequestException('Invalid halqa selection');
      }
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        branchId,
        title: dto.title,
        description: dto.description,
        icon: dto.icon,
        audience: dto.audience,
        targetHalqaIds,
        createdById,
      },
    });

    const payload = {
      type: NotificationType.ANNOUNCEMENT,
      title: announcement.title,
      body: announcement.description ?? '',
      data: { announcementId: announcement.id },
    };

    if (dto.audience === 'ALL' || dto.audience === 'TEACHERS') {
      await this.notifications.notifyBranchTeachers(branchId, payload);
    }
    if (dto.audience === 'ALL' || dto.audience === 'STUDENTS') {
      if (targetHalqaIds.length) {
        await this.notifications.notifyUsers(branchId, await this.getHalqaStudentUserIds(targetHalqaIds), payload);
      } else {
        await this.notifications.notifyBranchStudents(branchId, payload);
      }
    }

    return announcement;
  }

  /** Teacher path: always STUDENTS audience, scoped to the caller's own Halqa roster. */
  private async createForOwnHalqa(branchId: string, createdById: string, dto: CreateAnnouncementDto) {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId: createdById } });
    if (!teacher) {
      throw new BadRequestException('Only teachers or admins can create announcements');
    }

    const halqas = await this.prisma.halqa.findMany({
      where: { teacherId: teacher.id, branchId },
      select: { id: true },
    });
    const halqaIds = halqas.map((h) => h.id);
    if (halqaIds.length === 0) {
      throw new BadRequestException('You have no Halqa assigned — there are no students to notify.');
    }

    const announcement = await this.prisma.announcement.create({
      data: {
        branchId,
        title: dto.title,
        description: dto.description,
        icon: dto.icon,
        audience: 'STUDENTS',
        targetHalqaIds: halqaIds,
        createdById,
      },
    });

    await this.notifications.notifyUsers(branchId, await this.getHalqaStudentUserIds(halqaIds), {
      type: NotificationType.ANNOUNCEMENT,
      title: announcement.title,
      body: announcement.description ?? '',
      data: { announcementId: announcement.id },
    });

    return announcement;
  }

  private async getHalqaStudentUserIds(halqaIds: string[]): Promise<string[]> {
    const halqaStudents = await this.prisma.halqaStudent.findMany({
      where: {
        halqaId: { in: halqaIds },
        removedAt: null,
        student: { status: 'ACTIVE', userId: { not: null } },
      },
      select: { student: { select: { userId: true } } },
    });
    return halqaStudents.map((hs) => hs.student.userId).filter((id): id is string => id !== null);
  }

  /** Scopes the announcement feed to what the viewer is actually allowed to see. */
  async buildVisibilityFilter(branchId: string, viewerUserId: string): Promise<Prisma.AnnouncementWhereInput> {
    const student = await this.prisma.student.findUnique({ where: { userId: viewerUserId } });
    if (student) {
      const memberships = await this.prisma.halqaStudent.findMany({
        where: { studentId: student.id, removedAt: null },
        select: { halqaId: true },
      });
      const halqaIds = memberships.map((m) => m.halqaId);

      return {
        branchId,
        OR: [
          { audience: 'ALL' },
          { audience: 'STUDENTS', targetHalqaIds: { isEmpty: true } },
          ...(halqaIds.length ? [{ audience: 'STUDENTS' as const, targetHalqaIds: { hasSome: halqaIds } }] : []),
        ],
      };
    }

    if (await this.isAdminTier(viewerUserId)) {
      return { branchId };
    }

    // Teacher: branch-wide announcements only, never another teacher's
    // Halqa-scoped student announcements.
    return { branchId, audience: { in: ['ALL', 'TEACHERS'] } };
  }
}
