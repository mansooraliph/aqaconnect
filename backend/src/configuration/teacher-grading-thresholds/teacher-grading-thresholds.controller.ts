import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { TeacherGradingThresholdsService } from './teacher-grading-thresholds.service';
import { UpdateTeacherGradingThresholdsDto } from './dto/update-teacher-grading-thresholds.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

// Global resource — no :branchId, so no BranchScopeGuard. Gated by its own
// `teacher_grading_thresholds` permission module (not `configuration.*`) so
// a Branch Admin's broad configuration-module grant never picks this up.
@Controller('teacher-grading-thresholds')
@UseGuards(PermissionsGuard)
export class TeacherGradingThresholdsController {
  constructor(private readonly service: TeacherGradingThresholdsService) {}

  @Get()
  @RequirePermission('teacher_grading_thresholds.view')
  findOne() {
    return this.service.findOne();
  }

  @Patch()
  @RequirePermission('teacher_grading_thresholds.manage')
  update(@Body() dto: UpdateTeacherGradingThresholdsDto) {
    return this.service.update(dto);
  }
}
