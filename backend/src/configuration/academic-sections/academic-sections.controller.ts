import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AcademicSectionsService } from './academic-sections.service';
import { CreateAcademicSectionDto } from './dto/create-academic-section.dto';
import { UpdateAcademicSectionDto } from './dto/update-academic-section.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/academic-sections')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class AcademicSectionsController {
  constructor(private readonly service: AcademicSectionsService) {}

  @Get()
  @RequirePermission('configuration.academic_sections.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('configuration.academic_sections.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateAcademicSectionDto) {
    return this.service.create(branchId, dto);
  }

  @Get(':id')
  @RequirePermission('configuration.academic_sections.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Patch(':id')
  @RequirePermission('configuration.academic_sections.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAcademicSectionDto,
  ) {
    return this.service.update(branchId, id, dto);
  }
}
