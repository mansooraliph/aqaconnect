import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateTeacherGradingThresholdsDto } from './dto/update-teacher-grading-thresholds.dto';

/**
 * Global, branch-agnostic Super Admin setting: the ratio cutoffs
 * getCenterPerformanceReport's teamGradeFor uses to grade a teacher's own
 * performance. Singleton table — findOne() finds-or-creates the one row
 * (there's no fixed well-known id to key off, so the first row found is
 * always treated as *the* row, matching the create-on-first-read shape of
 * BranchSettingsService.findOne, minus the per-branch key).
 */
@Injectable()
export class TeacherGradingThresholdsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne() {
    const existing = await this.prisma.teacherGradingThresholds.findFirst();
    if (existing) {
      return existing;
    }
    return this.prisma.teacherGradingThresholds.create({ data: {} });
  }

  async update(dto: UpdateTeacherGradingThresholdsDto) {
    const existing = await this.findOne();
    return this.prisma.teacherGradingThresholds.update({
      where: { id: existing.id },
      data: dto,
    });
  }
}
