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
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { TeachersService } from './teachers.service';
import { StoreTeacherDto } from './dto/store-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { Reply } from '../common/reply';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

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
  // Multer parses the text fields when it does. The photo itself is
  // received and discarded — no avatar storage exists yet.
  @Post('store')
  @UseInterceptors(FileInterceptor('image'))
  async store(@Req() req: AuthedRequest, @Body() dto: StoreTeacherDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    try {
      const teacher = await this.service.store(branchId, dto);
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
  @UseInterceptors(FileInterceptor('image'))
  async update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: UpdateTeacherDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    try {
      const teacher = await this.service.update(branchId, id, dto);
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
