import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerateCalendarDaysDto } from './dto/generate-calendar-days.dto';
import { UpdateCalendarDayDto } from './dto/update-calendar-day.dto';

@Injectable()
export class CalendarDaysService {
  constructor(private readonly prisma: PrismaService) {}

  private monthRange(month?: number, year?: number) {
    if (month === undefined || year === undefined) {
      return undefined;
    }
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return { gte: start, lt: end };
  }

  list(branchId: string, academicYearId?: string, month?: number, year?: number) {
    const dateFilter = this.monthRange(month, year);
    return this.prisma.calendarDay.findMany({
      where: {
        branchId,
        ...(academicYearId && { academicYearId }),
        ...(dateFilter && { date: dateFilter }),
      },
      orderBy: { date: 'asc' },
    });
  }

  async findOne(branchId: string, id: string) {
    const day = await this.prisma.calendarDay.findFirst({ where: { id, branchId } });
    if (!day) {
      throw new NotFoundException('Calendar day not found');
    }
    return day;
  }

  async update(branchId: string, id: string, dto: UpdateCalendarDayDto) {
    await this.findOne(branchId, id);
    return this.prisma.calendarDay.update({
      where: { id },
      data: {
        ...(dto.isWorkingDay !== undefined && { isWorkingDay: dto.isWorkingDay }),
        ...(dto.isHoliday !== undefined && { isHoliday: dto.isHoliday }),
        ...(dto.note !== undefined && { note: dto.note }),
      },
    });
  }

  private async assertAcademicYearBelongsToBranch(branchId: string, academicYearId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, branchId },
    });
    if (!year) {
      throw new BadRequestException('academicYearId must belong to this branch');
    }
    return year;
  }

  /** Idempotent: only creates rows for dates that don't already have one for this branch. */
  async generate(branchId: string, dto: GenerateCalendarDaysDto) {
    const year = await this.assertAcademicYearBelongsToBranch(branchId, dto.academicYearId);

    const allDates: Date[] = [];
    const cursor = new Date(
      Date.UTC(year.startDate.getUTCFullYear(), year.startDate.getUTCMonth(), year.startDate.getUTCDate()),
    );
    const end = new Date(
      Date.UTC(year.endDate.getUTCFullYear(), year.endDate.getUTCMonth(), year.endDate.getUTCDate()),
    );
    while (cursor.getTime() <= end.getTime()) {
      allDates.push(new Date(cursor.getTime()));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const existing = await this.prisma.calendarDay.findMany({
      where: { branchId, date: { gte: allDates[0], lte: end } },
      select: { date: true },
    });
    const existingDates = new Set(existing.map((d) => d.date.getTime()));

    const missing = allDates.filter((d) => !existingDates.has(d.getTime()));
    if (missing.length === 0) {
      return { created: 0, skipped: allDates.length };
    }

    await this.prisma.$transaction(
      missing.map((date) => {
        const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
        const isWorkingDay = dayOfWeek !== 0 && dayOfWeek !== 6;
        return this.prisma.calendarDay.create({
          data: {
            branchId,
            academicYearId: dto.academicYearId,
            date,
            isWorkingDay,
          },
        });
      }),
    );

    return { created: missing.length, skipped: allDates.length - missing.length };
  }

  async stats(branchId: string, academicYearId?: string, month?: number, year?: number) {
    const dateFilter = this.monthRange(month, year);
    const days = await this.prisma.calendarDay.findMany({
      where: {
        branchId,
        ...(academicYearId && { academicYearId }),
        ...(dateFilter && { date: dateFilter }),
      },
      select: { isWorkingDay: true, isHoliday: true },
    });

    return {
      totalDays: days.length,
      workingDays: days.filter((d) => d.isWorkingDay).length,
      holidays: days.filter((d) => d.isHoliday).length,
    };
  }
}
