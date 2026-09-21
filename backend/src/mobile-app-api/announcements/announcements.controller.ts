import { Body, Controller, Get, Post, Req, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { MobileAnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { Reply } from '../common/reply';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

interface AuthedRequest extends Request {
  user: { userId: string };
}

@Controller('app/announcements')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.announcements.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class MobileAnnouncementsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly service: MobileAnnouncementsService,
    private readonly context: MobileContextService,
  ) {}

  @Get()
  async list(@Req() req: AuthedRequest) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const data = await this.prisma.announcement.findMany({
      where: { branchId },
      orderBy: { publishedAt: 'desc' },
    });
    return Reply.dataOnly({ error: false, data });
  }

  @Post('store')
  @RequirePermission('mobile_api.announcements.manage')
  async store(@Req() req: AuthedRequest, @Body() dto: CreateAnnouncementDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const announcement = await this.service.create(branchId, req.user.userId, dto);
    return Reply.successWithData('Announcement created successfully.', { announcement });
  }
}
