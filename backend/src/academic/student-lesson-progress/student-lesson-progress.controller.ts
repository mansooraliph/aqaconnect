import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { LessonProgressStatus } from '@prisma/client';
import { StudentLessonProgressService } from './student-lesson-progress.service';
import { CreateStudentLessonProgressDto } from './dto/create-student-lesson-progress.dto';
import { MarkStudentLessonProgressDto } from './dto/mark-student-lesson-progress.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('branches/:branchId/student-lesson-progress')
@UseGuards(PermissionsGuard, BranchScopeGuard)
export class StudentLessonProgressController {
  constructor(private readonly service: StudentLessonProgressService) {}

  @Get()
  @RequirePermission('academic.lesson_progress.view')
  list(
    @Param('branchId') branchId: string,
    @Query('studentId') studentId?: string,
    @Query('lessonId') lessonId?: string,
    @Query('status') status?: LessonProgressStatus,
  ) {
    return this.service.list(branchId, studentId, lessonId, status);
  }

  @Post()
  @RequirePermission('academic.lesson_progress.mark')
  create(@Param('branchId') branchId: string, @Body() dto: CreateStudentLessonProgressDto) {
    return this.service.create(branchId, dto);
  }

  @Post(':id/mark')
  @RequirePermission('academic.lesson_progress.mark')
  mark(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: MarkStudentLessonProgressDto,
  ) {
    return this.service.mark(branchId, id, dto);
  }

  @Post(':id/verify')
  @RequirePermission('academic.lesson_progress.verify')
  verify(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.verify(branchId, id, user.userId);
  }

  @Post(':id/reset')
  @RequirePermission('academic.lesson_progress.mark')
  reset(@Param('branchId') branchId: string, @Param('id') id: string) {
    return this.service.reset(branchId, id);
  }
}
