import { Controller, Get, Param, Query, Req, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { Request } from 'express';
import { LessonContentService } from './lesson-content.service';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

interface AuthedRequest extends Request {
  user: { userId: string };
}

@Controller('app/lesson-stages')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.lesson_content.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class LessonStagesController {
  constructor(private readonly service: LessonContentService) {}

  @Get()
  async index() {
    const stages = await this.service.listStages();
    return { status: 'success', data: stages };
  }

  @Get('show/:id')
  async show(@Param('id') id: string) {
    const stage = await this.service.findStage(id);
    return { status: 'success', data: stage };
  }
}

@Controller('app/lessons')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.lesson_content.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class LessonsController {
  constructor(
    private readonly service: LessonContentService,
    private readonly context: MobileContextService,
  ) {}

  @Get()
  async index(
    @Req() req: AuthedRequest,
    @Query('stage_id') stageId?: string,
    @Query('sub_stage_id') subStageId?: string,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const lessons = await this.service.listLessons(branchId, stageId, subStageId);
    return { status: 'success', data: lessons };
  }
}
