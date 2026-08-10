import { Controller, Get, Req, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { Request } from 'express';
import { ProfileService } from './profile.service';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { Reply } from '../common/reply';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

interface AuthedRequest extends Request {
  user: { userId: string };
}

@Controller('app')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.profile.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class ProfileController {
  constructor(
    private readonly service: ProfileService,
    private readonly context: MobileContextService,
  ) {}

  @Get('profile')
  async show(@Req() req: AuthedRequest) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const profile = await this.service.getProfile(branchId, req.user.userId);
    return Reply.dataOnly({ error: false, data: profile });
  }
}
