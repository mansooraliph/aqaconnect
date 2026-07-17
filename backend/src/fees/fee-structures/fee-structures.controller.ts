import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { FeeStructuresService } from './fee-structures.service';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { UpsertInstallmentsDto } from './dto/upsert-installments.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/fee-structures')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class FeeStructuresController {
  constructor(private readonly service: FeeStructuresService) {}

  @Get()
  @RequirePermission('fees.structures.view')
  list(@Param('branchId') branchId: string) {
    return this.service.list(branchId);
  }

  @Post()
  @RequirePermission('fees.structures.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateFeeStructureDto) {
    return this.service.create(branchId, dto);
  }

  @Get(':id')
  @RequirePermission('fees.structures.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Patch(':id')
  @RequirePermission('fees.structures.manage')
  update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFeeStructureDto,
  ) {
    return this.service.update(branchId, id, dto);
  }

  @Post(':id/installments')
  @RequirePermission('fees.structures.manage')
  upsertInstallments(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpsertInstallmentsDto,
  ) {
    return this.service.upsertInstallments(branchId, id, dto);
  }
}
