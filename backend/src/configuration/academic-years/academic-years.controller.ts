import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/academic-years')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class AcademicYearsController {
  constructor(private readonly service: AcademicYearsService) {}

  @Get()
  @RequirePermission('configuration.academic_years.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('configuration.academic_years.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateAcademicYearDto) {
    return this.service.create(branchId, dto);
  }

  @Get(':id')
  @RequirePermission('configuration.academic_years.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Patch(':id')
  @RequirePermission('configuration.academic_years.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAcademicYearDto,
  ) {
    return this.service.update(branchId, id, dto);
  }

  @Post(':id/make-current')
  @RequirePermission('configuration.academic_years.manage')
  makeCurrent(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.makeCurrent(branchId, id);
  }
}
