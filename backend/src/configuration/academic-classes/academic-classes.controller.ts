import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AcademicClassesService } from './academic-classes.service';
import { CreateAcademicClassDto } from './dto/create-academic-class.dto';
import { UpdateAcademicClassDto } from './dto/update-academic-class.dto';
import { BulkActionDto } from '../../common/dto/bulk-action.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/academic-classes')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class AcademicClassesController {
  constructor(private readonly service: AcademicClassesService) {}

  @Get()
  @RequirePermission('configuration.academic_classes.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('configuration.academic_classes.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateAcademicClassDto) {
    return this.service.create(branchId, dto);
  }

  @Get(':id')
  @RequirePermission('configuration.academic_classes.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Patch(':id')
  @RequirePermission('configuration.academic_classes.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAcademicClassDto,
  ) {
    return this.service.update(branchId, id, dto);
  }

  @Post('bulk-action')
  @RequirePermission('configuration.academic_classes.manage')
  bulkAction(@Param('branchId') branchId: string, @Body() dto: BulkActionDto) {
    return this.service.bulkAction(branchId, dto);
  }
}
