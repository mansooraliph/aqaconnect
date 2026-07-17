import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ExamResultsService } from './exam-results.service';
import { BulkEntryResultsDto } from './dto/bulk-entry-results.dto';
import { PublishResultsDto } from './dto/publish-results.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('branches/:branchId/exams/:examId/results')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class ExamResultsController {
  constructor(private readonly service: ExamResultsService) {}

  @Get()
  @RequirePermission('academic.exam_results.view')
  list(@Param('branchId') branchId: string, @Param('examId') examId: string) {
    return this.service.list(branchId, examId);
  }

  @Get('unmarked-students')
  @RequirePermission('academic.exam_results.view')
  unmarkedStudents(@Param('branchId') branchId: string, @Param('examId') examId: string) {
    return this.service.unmarkedStudents(branchId, examId);
  }

  @Post('bulk-entry')
  @RequirePermission('academic.exam_results.enter')
  bulkEntry(
    @Param('branchId') branchId: string,
    @Param('examId') examId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkEntryResultsDto,
  ) {
    return this.service.bulkEntry(branchId, examId, user.userId, dto);
  }

  @Post('publish')
  @RequirePermission('academic.exam_results.publish')
  publish(
    @Param('branchId') branchId: string,
    @Param('examId') examId: string,
    @Body() dto: PublishResultsDto,
  ) {
    return this.service.publish(branchId, examId, dto);
  }
}
