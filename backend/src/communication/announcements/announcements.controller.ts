import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('branches/:branchId/announcements')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  @Get()
  @RequirePermission('communication.announcements.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('communication.announcements.manage')
  create(
    @Param('branchId') branchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.service.create(branchId, user.userId, dto);
  }

  @Delete(':id')
  @RequirePermission('communication.announcements.manage')
  delete(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.delete(branchId, id);
  }
}
