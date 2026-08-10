import { Controller, Get, Req, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { Request } from 'express';
import { DepartmentsService } from '../../hr/departments/departments.service';
import { DesignationsService } from '../../hr/designations/designations.service';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { Reply } from '../common/reply';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

interface AuthedRequest extends Request {
  user: { userId: string };
}

/** Mirrors legacy `DepartmentApiController` (`/app/departments`, `/app/designations`) — read-only lookups. */
@Controller('app')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.hr_lookups.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class HrLookupsController {
  constructor(
    private readonly departments: DepartmentsService,
    private readonly designations: DesignationsService,
    private readonly context: MobileContextService,
  ) {}

  @Get('departments')
  async departmentsList(@Req() req: AuthedRequest) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const records = await this.departments.list(branchId);
    return Reply.dataOnly({ departments: records.map((d) => ({ id: d.id, name: d.name })) });
  }

  @Get('designations')
  async designationsList(@Req() req: AuthedRequest) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const records = await this.designations.list(branchId);
    return Reply.dataOnly({ designations: records.map((d) => ({ id: d.id, name: d.name })) });
  }
}
