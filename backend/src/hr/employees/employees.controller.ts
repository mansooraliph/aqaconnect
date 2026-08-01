import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { BulkActionDto } from '../../common/dto/bulk-action.dto';
import { parseEmployeesWorkbook } from './employees.import';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/employees')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get()
  @RequirePermission('hr.employees.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('hr.employees.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateEmployeeDto) {
    return this.service.create(branchId, dto);
  }

  @Post('import')
  @RequirePermission('hr.employees.manage')
  @UseInterceptors(FileInterceptor('file'))
  async import(@Param('branchId') branchId: string, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('file is required (multipart field name "file")');
    }
    const rows = await parseEmployeesWorkbook(file.buffer);
    return this.service.importRows(branchId, rows);
  }

  @Get(':id')
  @RequirePermission('hr.employees.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Patch(':id')
  @RequirePermission('hr.employees.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.service.update(branchId, id, dto);
  }

  @Post('bulk-action')
  @RequirePermission('hr.employees.manage')
  bulkAction(@Param('branchId') branchId: string, @Body() dto: BulkActionDto) {
    return this.service.bulkAction(branchId, dto);
  }
}
