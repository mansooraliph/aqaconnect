import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseAdminService } from './firebase-admin.service';

export interface NotifyPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseAdminService,
  ) {}

  async registerDeviceToken(userId: string, token: string, platform?: string) {
    return this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  async unregisterDeviceToken(token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { token } });
  }

  async listForUser(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { items, total, unreadCount, page, limit };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /** Persists a Notification row per user and best-effort pushes to all of that user's registered devices. */
  async notifyUsers(branchId: string, userIds: string[], payload: NotifyPayload) {
    const distinctUserIds = [...new Set(userIds)];
    if (distinctUserIds.length === 0) {
      return;
    }

    await this.prisma.notification.createMany({
      data: distinctUserIds.map((userId) => ({
        branchId,
        userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data as Prisma.InputJsonValue | undefined,
      })),
    });

    if (!this.firebase.isEnabled) {
      return;
    }

    const deviceTokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: distinctUserIds } },
      select: { token: true },
    });
    if (deviceTokens.length === 0) {
      return;
    }

    const tokens = deviceTokens.map((row) => row.token);
    const invalidTokens = await this.firebase.sendToTokens(tokens, payload.title, payload.body, payload.data);
    if (invalidTokens.length > 0) {
      await this.prisma.deviceToken.deleteMany({ where: { token: { in: invalidTokens } } });
    }
  }

  async notifyUser(branchId: string, userId: string, payload: NotifyPayload) {
    return this.notifyUsers(branchId, [userId], payload);
  }

  /** Notifies every student in the branch who has a linked user account. */
  async notifyBranchStudents(branchId: string, payload: NotifyPayload) {
    const students = await this.prisma.student.findMany({
      where: { branchId, status: 'ACTIVE', userId: { not: null } },
      select: { userId: true },
    });
    const userIds = students.map((student) => student.userId).filter((id): id is string => id !== null);
    return this.notifyUsers(branchId, userIds, payload);
  }
}
