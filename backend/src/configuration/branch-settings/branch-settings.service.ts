import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateBranchSettingsDto } from './dto/update-branch-settings.dto';
import { UserAccessContext } from '../../rbac/access-control.service';

@Injectable()
export class BranchSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(branchId: string) {
    const existing = await this.prisma.branchSettings.findUnique({ where: { branchId } });
    if (existing) {
      return existing;
    }
    return this.prisma.branchSettings.create({ data: { branchId } });
  }

  private async assertAcademicYearBelongsToBranch(branchId: string, academicYearId: string) {
    const year = await this.prisma.academicYear.findFirst({ where: { id: academicYearId, branchId } });
    if (!year) {
      throw new BadRequestException('academicYearId must belong to this branch');
    }
  }

  /**
   * Weekend pattern is Super Admin-owned, not a Branch Admin self-service
   * field — MasterCalendarService.publish() recomputes CalendarDay.isWorkingDay
   * from this value, so letting a Branch Admin change it independently of
   * Super Admin's publish/generate sequencing is exactly the race condition
   * that caused it to silently go stale.
   */
  private assertCanSetWeekendDays(accessContext: UserAccessContext) {
    if (!accessContext.permissions.has('master_calendar.manage')) {
      throw new ForbiddenException("Only Super Admin can set a branch's weekend days");
    }
  }

  async update(branchId: string, dto: UpdateBranchSettingsDto, accessContext: UserAccessContext) {
    if (dto.weekendDays !== undefined) {
      this.assertCanSetWeekendDays(accessContext);
    }
    if (dto.academicYearId) {
      await this.assertAcademicYearBelongsToBranch(branchId, dto.academicYearId);
    }
    await this.findOne(branchId);
    return this.prisma.branchSettings.update({ where: { branchId }, data: dto });
  }

  /** Super Admin sets the same weekend pattern across many branches in one call instead of one-by-one. */
  async bulkSetWeekendDays(branchIds: string[], weekendDays: number[]) {
    let updated = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const branchId of branchIds) {
        await tx.branchSettings.upsert({
          where: { branchId },
          update: { weekendDays },
          create: { branchId, weekendDays },
        });
        updated++;
      }
    });
    return { updated };
  }
}
