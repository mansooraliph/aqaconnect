import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  list(branchId: string) {
    return this.prisma.announcement.findMany({
      where: { branchId },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async create(branchId: string, createdById: string, dto: CreateAnnouncementDto) {
    const announcement = await this.prisma.announcement.create({
      data: {
        branchId,
        title: dto.title,
        description: dto.description,
        icon: dto.icon,
        createdById,
      },
    });

    await this.notifications.notifyBranchStudents(branchId, {
      type: NotificationType.ANNOUNCEMENT,
      title: announcement.title,
      body: announcement.description ?? '',
      data: { announcementId: announcement.id },
    });

    return announcement;
  }

  async delete(branchId: string, id: string) {
    const existing = await this.prisma.announcement.findFirst({ where: { id, branchId } });
    if (!existing) {
      throw new NotFoundException('Announcement not found');
    }
    await this.prisma.announcement.delete({ where: { id } });
  }
}
