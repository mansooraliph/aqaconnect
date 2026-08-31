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
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { MobileHalqasService } from './halqas.service';
import { StoreHalqaDto } from './dto/store-halqa.dto';
import { UpdateHalqaDto } from './dto/update-halqa.dto';
import { AssignStudentsDto } from './dto/assign-students.dto';
import { GetUnassignedStudentsQueryDto } from './dto/get-unassigned-students-query.dto';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { Reply } from '../common/reply';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

interface AuthedRequest extends Request {
  user: { userId: string };
}

/** Mirrors legacy `Route::prefix('halqas')->group(...)`, i.e. `/api/app/halqas`. */
@Controller('app/halqas')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.halqas.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class HalqasController {
  constructor(
    private readonly service: MobileHalqasService,
    private readonly context: MobileContextService,
  ) {}

  @Get(':halqaId/students')
  async getHalqaStudents(@Req() req: AuthedRequest, @Param('halqaId') halqaId: string, @Query('search') search?: string) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.getHalqaStudents(branchId, halqaId, search ?? ''), 'retrieve students');
  }

  @Get()
  async index(@Req() req: AuthedRequest) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.index(branchId, req.user.userId), 'retrieve halqas');
  }

  @Post('store')
  async store(@Req() req: AuthedRequest, @Body() dto: StoreHalqaDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    try {
      const halqa = await this.service.store(branchId, req.user.userId, dto);
      return Reply.successWithData('Halqa added successfully.', { halqa });
    } catch (error) {
      // Legacy: `catch (\Exception $e) { return Reply::error($e->getMessage()); }`
      // — HTTP 200 with a fail-status body, not a real 500.
      if (error instanceof HttpException) throw error;
      return Reply.error((error as Error).message);
    }
  }

  @Get('show/:id')
  async show(@Req() req: AuthedRequest, @Param('id') id: string) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const halqa = await this.service.show(branchId, id);
    return Reply.dataOnly({ halqa });
  }

  @Patch('update/:id')
  async update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: UpdateHalqaDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    try {
      const halqa = await this.service.update(branchId, req.user.userId, id, dto);
      return Reply.successWithData('Halqa updated successfully.', { halqa });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return Reply.error((error as Error).message);
    }
  }

  @Delete('destroy/:id')
  async destroy(@Req() req: AuthedRequest, @Param('id') id: string) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    try {
      await this.service.destroy(branchId, id);
      return Reply.success('Halqa deleted successfully.');
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return Reply.error((error as Error).message);
    }
  }

  @Get('classes')
  async classes(@Req() req: AuthedRequest) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const classes = await this.service.classes(branchId);
    return Reply.dataOnly({ classes });
  }

  @Post('assign-student')
  async assignStudents(@Req() req: AuthedRequest, @Body() dto: AssignStudentsDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.assignStudents(branchId, req.user.userId, dto), 'assign students');
  }

  @Get('unassigned-students')
  async getUnassignedStudents(@Req() req: AuthedRequest, @Query() query: GetUnassignedStudentsQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.service.getUnassignedStudents(branchId, query);
  }

  private async handle<T>(fn: () => Promise<T>, action: string): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        status: 'error',
        message: `Failed to ${action}: ${(error as Error).message}`,
      });
    }
  }
}
