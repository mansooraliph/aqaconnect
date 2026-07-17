import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AcademicClassSectionYearsService } from './academic-class-section-years.service';
import { GenerateClassSectionYearsDto } from './dto/generate.dto';
import { UpdateClassSectionYearDto } from './dto/update-class-section-year.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/academic-class-section-years')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class AcademicClassSectionYearsController {
  constructor(private readonly service: AcademicClassSectionYearsService) {}

  @Get()
  @RequirePermission('configuration.class_section_years.view')
  list(@Param('branchId') branchId: string, @Query('academicYearId') academicYearId?: string) {
    return this.service.list(branchId, academicYearId);
  }

  @Get(':id')
  @RequirePermission('configuration.class_section_years.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Post('preview-generation')
  @RequirePermission('configuration.class_section_years.manage')
  previewGeneration(
    @Param('branchId') branchId: string,
    @Body() dto: GenerateClassSectionYearsDto,
  ) {
    return this.service.previewGeneration(branchId, dto);
  }

  @Post('generate')
  @RequirePermission('configuration.class_section_years.manage')
  generate(@Param('branchId') branchId: string, @Body() dto: GenerateClassSectionYearsDto) {
    return this.service.generate(branchId, dto);
  }

  @Patch(':id')
  @RequirePermission('configuration.class_section_years.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateClassSectionYearDto,
  ) {
    return this.service.update(branchId, id, dto);
  }
}
