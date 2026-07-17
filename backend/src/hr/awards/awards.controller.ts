import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AwardsService } from './awards.service';
import { CreateAwardDto } from './dto/create-award.dto';
import { UpdateAwardDto } from './dto/update-award.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/awards')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class AwardsController {
  constructor(private readonly service: AwardsService) {}

  @Get()
  @RequirePermission('hr.awards.view')
  list(@Param('branchId') branchId: string, @Query('employeeId') employeeId?: string) {
    return this.service.list(branchId, employeeId);
  }

  @Post()
  @RequirePermission('hr.awards.create')
  create(@Param('branchId') branchId: string, @Body() dto: CreateAwardDto) {
    return this.service.create(branchId, dto);
  }

  // No separate `hr.awards.manage` key is seeded — this narrow status-only
  // update (e.g. revoking an award) deliberately reuses `hr.awards.create`
  // since Awards only has this one mutable field post-creation.
  @Patch(':id')
  @RequirePermission('hr.awards.create')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAwardDto,
  ) {
    return this.service.update(branchId, id, dto);
  }
}
