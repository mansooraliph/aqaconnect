import {
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { SurahSchedulesService } from './surah-schedules.service';
import { GetStudentScheduleQueryDto } from './dto/get-student-schedule-query.dto';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

interface AuthedRequest extends Request {
  user: { userId: string };
}

/** Mirrors legacy `Route::prefix('surah-schedules')->group(...)`, i.e. `/api/app/surah-schedules`. */
@Controller('app/surah-schedules')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.surah_schedules.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class SurahSchedulesController {
  constructor(
    private readonly service: SurahSchedulesService,
    private readonly context: MobileContextService,
  ) {}

  @Get('student/yearsmonths')
  async getOwnAvailableYearsMonths(@Req() req: AuthedRequest) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const studentId = await this.context.resolveOwnStudentId(req.user.userId);
    return this.handle(() => this.service.getAvailableYearsMonths(branchId, studentId));
  }

  @Get('student/yearsmonths/:studentId')
  async getAvailableYearsMonths(@Req() req: AuthedRequest, @Param('studentId') studentId: string) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.getAvailableYearsMonths(branchId, studentId));
  }

  @Get('student')
  async getOwnStudentSurahSchedule(@Req() req: AuthedRequest, @Query() query: GetStudentScheduleQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const studentId = await this.context.resolveOwnStudentId(req.user.userId);
    return this.handle(() => this.service.getStudentSurahSchedule(branchId, studentId, query));
  }

  @Get('student/:studentId')
  async getStudentSurahSchedule(
    @Req() req: AuthedRequest,
    @Param('studentId') studentId: string,
    @Query() query: GetStudentScheduleQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.getStudentSurahSchedule(branchId, studentId, query));
  }

  /** Mirrors the legacy controller's own try/catch → `{status:'error', message: 'Failed to retrieve ...: ' + e.message}` on 500. */
  private async handle<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        status: 'error',
        message: `Failed to retrieve student schedule: ${(error as Error).message}`,
      });
    }
  }
}
