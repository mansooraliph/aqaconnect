import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { mkdirSync } from 'fs';
import { ProfileService } from './profile.service';
import { EditProfileDto } from './dto/edit-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { Reply } from '../common/reply';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { UPLOADS_DIR } from './upload-paths';

mkdirSync(UPLOADS_DIR, { recursive: true });

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

  // The client uploads an avatar `image` file alongside the text fields.
  // The Flutter client checks `response.statusCode == 200` exactly (not
  // just 2xx) for this call — Nest's default 201 for POST would read as a
  // failure to it.
  @Post('edit-profile')
  @RequirePermission('mobile_api.profile.edit')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) =>
          cb(
            null,
            `${randomBytes(16).toString('hex')}${extname(file.originalname)}`,
          ),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async edit(
    @Req() req: AuthedRequest,
    @Body() dto: EditProfileDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const publicBaseUrl = `${req.protocol}://${req.get('host')}`;
    const profile = await this.service.editProfile(
      branchId,
      req.user.userId,
      dto,
      image,
      publicBaseUrl,
    );
    return Reply.dataOnly({ error: false, data: profile });
  }

  @Post('change-password')
  @RequirePermission('mobile_api.profile.edit')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Req() req: AuthedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.service.changePassword(req.user.userId, dto);
    return Reply.success('Password changed successfully. Please log in again.');
  }
}
