import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { MasterAcademicYearsService } from './master-academic-years.service';
import { CreateMasterAcademicYearDto } from './dto/create-master-academic-year.dto';
import { UpdateMasterAcademicYearDto } from './dto/update-master-academic-year.dto';
import { PublishMasterAcademicYearDto } from './dto/publish-master-academic-year.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

// Global resource — no :branchId, so no BranchScopeGuard. Gated by its own
// `master_academic_years` permission module (not `configuration.*`) so a
// Branch Admin's broad configuration-module grant never picks this up.
@Controller('master-academic-years')
@UseGuards(PermissionsGuard)
export class MasterAcademicYearsController {
  constructor(private readonly service: MasterAcademicYearsService) {}

  @Get()
  @RequirePermission('master_academic_years.view')
  list() {
    return this.service.list();
  }

  @Post()
  @RequirePermission('master_academic_years.manage')
  create(@Body() dto: CreateMasterAcademicYearDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission('master_academic_years.manage')
  update(@Param('id') id: string, @Body() dto: UpdateMasterAcademicYearDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/publish')
  @RequirePermission('master_academic_years.manage')
  publish(@Param('id') id: string, @Body() dto: PublishMasterAcademicYearDto) {
    return this.service.publish(id, dto);
  }
}
