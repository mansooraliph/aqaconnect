import {
  Body,
  Controller,
  HttpCode,
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
import { Request } from 'express';
import { AcademicClassesService } from './academic-classes.service';
import { StoreAcademicClassDto } from './dto/store-academic-class.dto';
import { UpdateAcademicClassDto } from './dto/update-academic-class.dto';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

interface AuthedRequest extends Request {
  user: { userId: string };
}

/** Mirrors legacy `Route::prefix('academic')->group(...)` under `app/`, i.e. `/api/app/academic/classes`. */
@Controller('app/academic/classes')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.academic_classes.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class AcademicClassesController {
  constructor(
    private readonly service: AcademicClassesService,
    private readonly context: MobileContextService,
  ) {}

  @Post()
  @HttpCode(201)
  async store(@Req() req: AuthedRequest, @Body() dto: StoreAcademicClassDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    try {
      const data = await this.service.store(branchId, req.user.userId, dto);
      return { status: 'success', message: 'Academic class created successfully.', data };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        status: 'error',
        message: `Failed to create class: ${(error as Error).message}`,
      });
    }
  }

  @Patch(':id')
  async update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAcademicClassDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    try {
      const data = await this.service.update(branchId, req.user.userId, id, dto);
      return { status: 'success', message: 'Academic class updated successfully.', data };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        status: 'error',
        message: `Failed to update class: ${(error as Error).message}`,
      });
    }
  }
}
