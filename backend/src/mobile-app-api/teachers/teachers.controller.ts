import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  InternalServerErrorException,
  Param,
  Patch,
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
import { TeachersService } from './teachers.service';
import { StoreTeacherDto } from './dto/store-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { Reply } from '../common/reply';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { UPLOADS_DIR } from '../profile/upload-paths';

mkdirSync(UPLOADS_DIR, { recursive: true });

const avatarUploadOptions = {
  storage: diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) =>
      cb(null, `${randomBytes(16).toString('hex')}${extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
};

interface AuthedRequest extends Request {
  user: { userId: string };
}

/** Mirrors legacy `Route::prefix('teachers')->group(...)`, i.e. `/api/app/teachers`. */
@Controller('app/teachers')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.teachers.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class TeachersController {
  constructor(
    private readonly service: TeachersService,
    private readonly context: MobileContextService,
  ) {}

  @Get()
  async index(@Req() req: AuthedRequest) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const teachers = await this.service.list(branchId);
    return Reply.dataOnly({ teachers });
  }

  @Get('show/:id')
  async show(@Req() req: AuthedRequest, @Param('id') id: string) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const teacher = await this.service.findOne(branchId, id);
    return Reply.dataOnly({ teacher });
  }

  // The client only sends multipart/form-data when a photo is attached
  // (plain JSON otherwise); FileInterceptor must be present either way so
  // Multer parses the text fields when it does.
  @Post('store')
  @UseInterceptors(FileInterceptor('image', avatarUploadOptions))
  async store(
    @Req() req: AuthedRequest,
    @Body() dto: StoreTeacherDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const publicBaseUrl = `${req.protocol}://${req.get('host')}`;
    try {
      const teacher = await this.service.store(branchId, dto, image, publicBaseUrl);
      return Reply.successWithData('Record saved successfully.', { user: teacher });
    } catch (error) {
      // Unexpected errors (e.g. a failed transaction) must surface as a
      // non-2xx status — returning Reply.error() here left Nest's default
      // 2xx status on the response, so the mobile client (which only checks
      // the status code) reported success for a save that never happened.
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException((error as Error).message);
    }
  }

  @Patch('update/:id')
  @UseInterceptors(FileInterceptor('image', avatarUploadOptions))
  async update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const publicBaseUrl = `${req.protocol}://${req.get('host')}`;
    try {
      const teacher = await this.service.update(branchId, id, dto, image, publicBaseUrl);
      return Reply.successWithData('Record updated successfully.', { user: teacher });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException((error as Error).message);
    }
  }

  @Delete('destroy/:id')
  async destroy(@Req() req: AuthedRequest, @Param('id') id: string) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    await this.service.destroy(branchId, id);
    return Reply.success('Record deleted successfully.');
  }
}
