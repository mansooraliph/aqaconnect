import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { DesignationsService } from './designations.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';
import { ChangeParentDto } from './dto/change-parent.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/designations')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class DesignationsController {
  constructor(private readonly service: DesignationsService) {}

  @Get()
  @RequirePermission('hr.designations.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('hr.designations.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateDesignationDto) {
    return this.service.create(branchId, dto);
  }

  @Get(':id')
  @RequirePermission('hr.designations.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Patch(':id')
  @RequirePermission('hr.designations.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDesignationDto,
  ) {
    return this.service.update(branchId, id, dto);
  }

  @Post(':id/change-parent')
  @RequirePermission('hr.designations.manage')
  changeParent(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: ChangeParentDto,
  ) {
    return this.service.changeParent(branchId, id, dto);
  }
}
