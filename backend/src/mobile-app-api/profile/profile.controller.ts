import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards, UseInterceptors, UsePipes } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { ProfileService } from './profile.service';
import { EditProfileDto } from './dto/edit-profile.dto';
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

  // The client uploads an avatar `image` file alongside the text fields, but
  // there's no avatar storage yet (see `image: null` placeholder in
  // ProfileService) — FileInterceptor just needs to be present so Multer
  // parses the multipart text fields into the DTO; the file itself is
  // received and discarded.
  // The Flutter client checks `response.statusCode == 200` exactly (not
  // just 2xx) for this call — Nest's default 201 for POST would read as a
  // failure to it.
  @Post('edit-profile')
  @RequirePermission('mobile_api.profile.edit')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('image'))
  async edit(@Req() req: AuthedRequest, @Body() dto: EditProfileDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const profile = await this.service.editProfile(branchId, req.user.userId, dto);
    return Reply.dataOnly({ error: false, data: profile });
  }
}
