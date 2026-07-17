import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FeeDemandsService } from './fee-demands.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/fee-structures/:feeStructureId')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class FeeStructureDemandsController {
  constructor(private readonly service: FeeDemandsService) {}

  @Post('preview-generation')
  @RequirePermission('fees.demands.generate')
  previewGeneration(
    @Param('branchId') branchId: string,
    @Param('feeStructureId') feeStructureId: string,
  ) {
    return this.service.previewGeneration(branchId, feeStructureId);
  }

  @Post('generate-demands')
  @RequirePermission('fees.demands.generate')
  generate(@Param('branchId') branchId: string, @Param('feeStructureId') feeStructureId: string) {
    return this.service.generate(branchId, feeStructureId);
  }

  @Get('demand-status')
  @RequirePermission('fees.demands.view')
  demandStatus(@Param('branchId') branchId: string, @Param('feeStructureId') feeStructureId: string) {
    return this.service.demandStatus(branchId, feeStructureId);
  }
}

@Controller('branches/:branchId/students/:studentId/fee-demands')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class StudentFeeDemandsController {
  constructor(private readonly service: FeeDemandsService) {}

  @Get()
  @RequirePermission('fees.demands.view')
  listForStudent(@Param('branchId') branchId: string, @Param('studentId') studentId: string) {
    return this.service.listForStudent(branchId, studentId);
  }
}
