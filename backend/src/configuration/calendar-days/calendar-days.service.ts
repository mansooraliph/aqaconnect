import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerateCalendarDaysDto } from './dto/generate-calendar-days.dto';
import { UpdateCalendarDayDto } from './dto/update-calendar-day.dto';
import { CreateCalendarDayDto } from './dto/create-calendar-day.dto';
import { InitiateDaysDto } from './dto/initiate-days.dto';
import { fetchIslamicHolidaysForYear } from './islamic-holidays';
import { DAY_NAMES, allDatesOfYear, isoWeekNumber, specificWeekendDates, weekdayDates } from './calendar-generation.util';

@Injectable()
export class CalendarDaysService {
  constructor(private readonly prisma: PrismaService) {}

  private monthRange(month?: number, year?: number) {
    if (year === undefined) return undefined;
    if (month === undefined) {
      return { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };
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

  /** Any branch-initiated edit marks the row customized so a later master-calendar publish never overwrites it. */
  async update(branchId: string, id: string, dto: UpdateCalendarDayDto) {
    await this.findOne(branchId, id);
    return this.prisma.calendarDay.update({
      where: { id },
      data: {
        ...(dto.isWorkingDay !== undefined && { isWorkingDay: dto.isWorkingDay }),
        ...(dto.isHoliday !== undefined && { isHoliday: dto.isHoliday }),
        ...(dto.holidayName !== undefined && { holidayName: dto.holidayName }),
        ...(dto.isEvent !== undefined && { isEvent: dto.isEvent }),
        ...(dto.eventName !== undefined && { eventName: dto.eventName }),
        ...(dto.note !== undefined && { note: dto.note }),
        isCustomized: true,
      },
    });
  }

  /**
   * Lets a branch add a single ad-hoc day that isn't already a generated row
   * (e.g. a branch-only event, or a date outside any generated range) —
   * always customized, since it's branch-authored by definition.
   */
  async create(branchId: string, dto: CreateCalendarDayDto) {
    const date = new Date(`${dto.date}T00:00:00.000Z`);
    const existing = await this.prisma.calendarDay.findUnique({ where: { branchId_date: { branchId, date } } });
    if (existing) {
      throw new BadRequestException('A calendar day already exists for this date — edit it instead');
    }

    const dayOfWeek = date.getUTCDay();
    return this.prisma.calendarDay.create({
      data: {
        branchId,
        date,
        dayName: DAY_NAMES[dayOfWeek],
        weekNumber: isoWeekNumber(date),
        year: date.getUTCFullYear(),
        isWorkingDay: dto.isWorkingDay ?? true,
        isHoliday: dto.isHoliday ?? false,
        holidayName: dto.holidayName,
        isEvent: dto.isEvent ?? false,
        eventName: dto.eventName,
        note: dto.note,
        isCustomized: true,
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
            dayName: DAY_NAMES[dayOfWeek],
            weekNumber: isoWeekNumber(date),
            year: date.getUTCFullYear(),
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

  // ── "Initiate Days" — matches the legacy CalendarDayController@generateDays ──

  /** Generates every day of the calendar year, skipping dates that already exist for this branch. */
  private async generateDaysForYear(branchId: string, year: number): Promise<number> {
    const allDates = allDatesOfYear(year);
    const existing = await this.prisma.calendarDay.findMany({
      where: { branchId, date: { gte: allDates[0], lte: allDates[allDates.length - 1] } },
      select: { date: true },
    });
    const existingDates = new Set(existing.map((d) => d.date.getTime()));
    const missing = allDates.filter((d) => !existingDates.has(d.getTime()));
    if (missing.length === 0) return 0;

    await this.prisma.calendarDay.createMany({
      data: missing.map((date) => {
        const dayOfWeek = date.getUTCDay();
        return {
          branchId,
          date,
          dayName: DAY_NAMES[dayOfWeek],
          weekNumber: isoWeekNumber(date),
          year,
          isWorkingDay: true,
          isHoliday: false,
        };
      }),
    });
    return missing.length;
  }

  /** Marks every occurrence of a weekday in the year as a holiday (row must already exist). */
  private async markWeekdayAsHoliday(branchId: string, year: number, weekday: string, holidayName: string): Promise<number> {
    const dates = weekdayDates(year, weekday);
    if (dates.length === 0) return 0;

    const result = await this.prisma.calendarDay.updateMany({
      where: { branchId, date: { in: dates } },
      data: { isHoliday: true, isWorkingDay: false, holidayName },
    });
    return result.count;
  }

  /** Marks only the requested nth Saturday/Sunday pair (1st/2nd/3rd/4th/last) per month as a holiday. */
  private async markSpecificWeekendsAsHoliday(
    branchId: string,
    year: number,
    weekendSelections: string[],
    holidayName: string,
  ): Promise<number> {
    let updated = 0;
    for (const { date, label } of specificWeekendDates(year, weekendSelections)) {
      const result = await this.prisma.calendarDay.updateMany({
        where: { branchId, date },
        data: { isHoliday: true, isWorkingDay: false, holidayName: `${holidayName} (${label})` },
      });
      updated += result.count;
    }
    return updated;
  }

  private async addIslamicHolidays(branchId: string, year: number): Promise<number> {
    const holidays = await fetchIslamicHolidaysForYear(year);
    let updated = 0;

    for (const holiday of holidays) {
      const date = new Date(`${holiday.date}T00:00:00.000Z`);
      const existing = await this.prisma.calendarDay.findUnique({ where: { branchId_date: { branchId, date } } });
      if (existing) {
        await this.prisma.calendarDay.update({
          where: { id: existing.id },
          data: { isHoliday: true, isWorkingDay: false, holidayName: holiday.name },
        });
      } else {
        const dayOfWeek = date.getUTCDay();
        await this.prisma.calendarDay.create({
          data: {
            branchId,
            date,
            dayName: DAY_NAMES[dayOfWeek],
            weekNumber: isoWeekNumber(date),
            year: date.getUTCFullYear(),
            isWorkingDay: false,
            isHoliday: true,
            holidayName: holiday.name,
          },
        });
      }
      updated++;
    }

    return updated;
  }

  /**
   * "Initiate Days" — generates a full calendar year and applies weekday/
   * weekend/Islamic holiday rules, mirroring the legacy generateDays()
   * controller action exactly (including its Saturday+Sunday-both special
   * case that branches into the weekendOption logic).
   */
  async initiateDays(branchId: string, dto: InitiateDaysDto) {
    const generatedDays = await this.generateDaysForYear(branchId, dto.year);

    let selectedWeekdays = [...(dto.selectedWeekdays ?? [])];
    const weekendOption = dto.weekendOption ?? 'all';
    const selectedWeekends = dto.selectedWeekends ?? [];
    const holidayName = dto.holidayName ?? 'Weekly Holiday';
    let updatedHolidays = 0;

    const saturdaySelected = selectedWeekdays.includes('saturday');
    const sundaySelected = selectedWeekdays.includes('sunday');

    if (saturdaySelected && sundaySelected) {
      selectedWeekdays = selectedWeekdays.filter((d) => d !== 'saturday' && d !== 'sunday');

      if (weekendOption === 'specific' && selectedWeekends.length > 0) {
        updatedHolidays += await this.markSpecificWeekendsAsHoliday(branchId, dto.year, selectedWeekends, holidayName);
      } else {
        updatedHolidays += await this.markWeekdayAsHoliday(branchId, dto.year, 'saturday', holidayName);
        updatedHolidays += await this.markWeekdayAsHoliday(branchId, dto.year, 'sunday', holidayName);
      }
    } else {
      if (saturdaySelected) {
        updatedHolidays += await this.markWeekdayAsHoliday(branchId, dto.year, 'saturday', holidayName);
        selectedWeekdays = selectedWeekdays.filter((d) => d !== 'saturday');
      }
      if (sundaySelected) {
        updatedHolidays += await this.markWeekdayAsHoliday(branchId, dto.year, 'sunday', holidayName);
        selectedWeekdays = selectedWeekdays.filter((d) => d !== 'sunday');
      }
    }

    for (const weekday of selectedWeekdays) {
      updatedHolidays += await this.markWeekdayAsHoliday(branchId, dto.year, weekday, holidayName);
    }

    if (dto.includeIslamicHolidays) {
      updatedHolidays += await this.addIslamicHolidays(branchId, dto.year);
    }

    return { generatedDays, updatedHolidays };
  }

  /** Deletes every CalendarDay row for this branch within the given calendar year (undo for "Initiate Days"). */
  async clearYear(branchId: string, year: number) {
    const result = await this.prisma.calendarDay.deleteMany({
      where: {
        branchId,
        date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
    });
    return { deleted: result.count };
  }
}
