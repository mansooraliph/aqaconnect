import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class MobileAnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(branchId: string, createdById: string, dto: CreateAnnouncementDto) {
    const announcement = await this.prisma.announcement.create({
      data: {
        branchId,
        title: dto.title,
        description: dto.description,
        icon: dto.icon,
        audience: dto.audience,
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
      await this.notifications.notifyBranchStudents(branchId, payload);
    }

    return announcement;
  }
}
