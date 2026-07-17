import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { FeeTypesService } from './fee-types.service';
import { CreateFeeTypeDto } from './dto/create-fee-type.dto';
import { UpdateFeeTypeDto } from './dto/update-fee-type.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/fee-types')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class FeeTypesController {
  constructor(private readonly service: FeeTypesService) {}

  @Get()
  @RequirePermission('fees.fee_types.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('fees.fee_types.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateFeeTypeDto) {
    return this.service.create(branchId, dto);
  }

  @Get(':id')
  @RequirePermission('fees.fee_types.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Patch(':id')
  @RequirePermission('fees.fee_types.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFeeTypeDto,
  ) {
    return this.service.update(branchId, id, dto);
  }
}
