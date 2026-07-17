import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AcademicClassSectionsService } from './academic-class-sections.service';
import { CreateClassSectionDto } from './dto/create-class-section.dto';
import { UpdateClassSectionDto } from './dto/update-class-section.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/academic-class-sections')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class AcademicClassSectionsController {
  constructor(private readonly service: AcademicClassSectionsService) {}

  @Get()
  @RequirePermission('configuration.class_sections.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('configuration.class_sections.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateClassSectionDto) {
    return this.service.create(branchId, dto);
  }

  @Get(':id')
  @RequirePermission('configuration.class_sections.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Patch(':id')
  @RequirePermission('configuration.class_sections.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateClassSectionDto,
  ) {
    return this.service.update(branchId, id, dto);
  }
}
