import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { TransferEnrollmentDto } from './dto/transfer-enrollment.dto';
import { QueryEnrollmentDto } from './dto/query-enrollment.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('branches/:branchId/enrollments')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  @Get()
  @RequirePermission('student_management.enrollments.view')
  list(@Param('branchId') branchId: string, @Query() query: QueryEnrollmentDto) {
    return this.service.list(branchId, query);
  }

  @Get('export')
  @RequirePermission('student_management.enrollments.view')
  async exportCsv(
    @Param('branchId') branchId: string,
    @Query() query: QueryEnrollmentDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.service.exportCsv(branchId, query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="enrollments-export.csv"',
    });
    return csv;
  }

  @Get(':id')
  @RequirePermission('student_management.enrollments.view')
  findOne(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.findOne(branchId, id);
  }

  @Post()
  @RequirePermission('student_management.enrollments.manage')
  create(@Param('branchId') branchId: string, @Body() dto: CreateEnrollmentDto) {
    return this.service.create(branchId, dto);
  }

  @Post(':id/transfer')
  @RequirePermission('student_management.enrollments.manage')
  transfer(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: TransferEnrollmentDto,
  ) {
    return this.service.transfer(branchId, id, dto);
  }

  @Post(':id/withdraw')
  @RequirePermission('student_management.enrollments.manage')
  withdraw(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.withdraw(branchId, id);
  }
}
