import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMasterCalendarDayDto } from './dto/update-master-calendar-day.dto';
import { InitiateMasterDaysDto } from './dto/initiate-master-days.dto';
import { PublishMasterCalendarDto } from './dto/publish-master-calendar.dto';
import { fetchIslamicHolidaysForYear } from '../calendar-days/islamic-holidays';
import { DAY_NAMES, allDatesOfYear, isoWeekNumber, specificWeekendDates, weekdayDates } from '../calendar-days/calendar-generation.util';

/**
 * Super Admin's single, branch-less common calendar. Mirrors
 * CalendarDaysService's "Initiate Days" wizard (same shared util) but writes
 * MasterCalendarDay instead of per-branch CalendarDay, plus `publish()` to
 * copy a year out to branches.
 */
@Injectable()
export class MasterCalendarService {
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

  list(month?: number, year?: number) {
    const dateFilter = this.monthRange(month, year);
    return this.prisma.masterCalendarDay.findMany({
      where: { ...(dateFilter && { date: dateFilter }) },
      orderBy: { date: 'asc' },
    });
  }

  async stats(month?: number, year?: number) {
    const dateFilter = this.monthRange(month, year);
    const days = await this.prisma.masterCalendarDay.findMany({
      where: { ...(dateFilter && { date: dateFilter }) },
      select: { isWorkingDay: true, isHoliday: true, isEvent: true },
    });

    return {
      totalDays: days.length,
      workingDays: days.filter((d) => d.isWorkingDay).length,
      holidays: days.filter((d) => d.isHoliday).length,
      events: days.filter((d) => d.isEvent).length,
    };
  }

  async findOne(id: string) {
    const day = await this.prisma.masterCalendarDay.findUnique({ where: { id } });
    if (!day) {
      throw new NotFoundException('Master calendar day not found');
    }
    return day;
  }

  /**
   * A holiday always closes the (master) calendar day — isWorkingDay can't
   * be true while isHoliday is true. If the caller changes isHoliday
   * without also explicitly setting isWorkingDay in the same request, we
   * derive it: false while the holiday is on, back to working once cleared
   * (the master calendar has no branch/weekend concept of its own to fall
   * back to, unlike CalendarDaysService). An explicit isWorkingDay in the
   * same request always wins.
   */
  async update(id: string, dto: UpdateMasterCalendarDayDto) {
    await this.findOne(id);
    let isWorkingDay = dto.isWorkingDay;
    if (dto.isHoliday !== undefined && dto.isWorkingDay === undefined) {
      isWorkingDay = !dto.isHoliday;
    }
    return this.prisma.masterCalendarDay.update({
      where: { id },
      data: {
        ...(isWorkingDay !== undefined && { isWorkingDay }),
        ...(dto.isHoliday !== undefined && { isHoliday: dto.isHoliday }),
        ...(dto.holidayName !== undefined && { holidayName: dto.holidayName }),
        ...(dto.isEvent !== undefined && { isEvent: dto.isEvent }),
        ...(dto.eventName !== undefined && { eventName: dto.eventName }),
        ...(dto.note !== undefined && { note: dto.note }),
      },
    });
  }

  /** Deletes every MasterCalendarDay row within the given calendar year (undo for "Initiate Days"). */
  async clearYear(year: number) {
    const result = await this.prisma.masterCalendarDay.deleteMany({
      where: { date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
    });
    return { deleted: result.count };
  }

  private async generateDaysForYear(year: number): Promise<number> {
    const allDates = allDatesOfYear(year);
    const existing = await this.prisma.masterCalendarDay.findMany({
      where: { date: { gte: allDates[0], lte: allDates[allDates.length - 1] } },
      select: { date: true },
    });
    const existingDates = new Set(existing.map((d) => d.date.getTime()));
    const missing = allDates.filter((d) => !existingDates.has(d.getTime()));
    if (missing.length === 0) return 0;

    await this.prisma.masterCalendarDay.createMany({
      data: missing.map((date) => {
        const dayOfWeek = date.getUTCDay();
        return {
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

  private async markWeekdayAsHoliday(year: number, weekday: string, holidayName: string): Promise<number> {
    const dates = weekdayDates(year, weekday);
    if (dates.length === 0) return 0;

    const result = await this.prisma.masterCalendarDay.updateMany({
      where: { date: { in: dates } },
      data: { isHoliday: true, isWorkingDay: false, holidayName },
    });
    return result.count;
  }

  private async markSpecificWeekendsAsHoliday(year: number, weekendSelections: string[], holidayName: string): Promise<number> {
    let updated = 0;
    for (const { date, label } of specificWeekendDates(year, weekendSelections)) {
      const result = await this.prisma.masterCalendarDay.updateMany({
        where: { date },
        data: { isHoliday: true, isWorkingDay: false, holidayName: `${holidayName} (${label})` },
      });
      updated += result.count;
    }
    return updated;
  }

  private async addIslamicHolidays(year: number): Promise<number> {
    const holidays = await fetchIslamicHolidaysForYear(year);
    let updated = 0;

    for (const holiday of holidays) {
      const date = new Date(`${holiday.date}T00:00:00.000Z`);
      const existing = await this.prisma.masterCalendarDay.findUnique({ where: { date } });
      if (existing) {
        await this.prisma.masterCalendarDay.update({
          where: { id: existing.id },
          data: { isHoliday: true, isWorkingDay: false, holidayName: holiday.name },
        });
      } else {
        const dayOfWeek = date.getUTCDay();
        await this.prisma.masterCalendarDay.create({
          data: {
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

  /** Same wizard as CalendarDaysService.initiateDays, writing MasterCalendarDay instead of a branch's CalendarDay. */
  async initiateDays(dto: InitiateMasterDaysDto) {
    const generatedDays = await this.generateDaysForYear(dto.year);

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
        updatedHolidays += await this.markSpecificWeekendsAsHoliday(dto.year, selectedWeekends, holidayName);
      } else {
        updatedHolidays += await this.markWeekdayAsHoliday(dto.year, 'saturday', holidayName);
        updatedHolidays += await this.markWeekdayAsHoliday(dto.year, 'sunday', holidayName);
      }
    } else {
      if (saturdaySelected) {
        updatedHolidays += await this.markWeekdayAsHoliday(dto.year, 'saturday', holidayName);
        selectedWeekdays = selectedWeekdays.filter((d) => d !== 'saturday');
      }
      if (sundaySelected) {
        updatedHolidays += await this.markWeekdayAsHoliday(dto.year, 'sunday', holidayName);
        selectedWeekdays = selectedWeekdays.filter((d) => d !== 'sunday');
      }
    }

    for (const weekday of selectedWeekdays) {
      updatedHolidays += await this.markWeekdayAsHoliday(dto.year, weekday, holidayName);
    }

    if (dto.includeIslamicHolidays) {
      updatedHolidays += await this.addIslamicHolidays(dto.year);
    }

    return { generatedDays, updatedHolidays };
  }

  /** This branch's configured weekend (day-of-week numbers, 0 = Sunday ... 6 = Saturday); [0, 6] if unset. */
  private async getWeekendDays(branchId: string): Promise<number[]> {
    const settings = await this.prisma.branchSettings.findUnique({
      where: { branchId },
      select: { weekendDays: true },
    });
    return settings?.weekendDays?.length ? settings.weekendDays : [0, 6];
  }

  /**
   * Copies this year's MasterCalendarDay rows into every target branch's own
   * CalendarDay. A branch day that's already isCustomized=true (edited or
   * manually created by that branch) is never touched — publish only fills
   * gaps and syncs days the branch hasn't customized. Returns a per-branch
   * summary so the UI can show what happened.
   *
   * isWorkingDay is deliberately NOT copied from the master as-is — the
   * master's own weekend assumption would otherwise overwrite every branch's
   * CalendarDay regardless of that branch's actual weekend. isWorkingDay is
   * recomputed per branch from its own weekendDays plus the propagated
   * isHoliday flag, so publish is safe to run before or after a branch
   * generates its own calendar.
   *
   * isHoliday is also true for any date on the branch's own weekend (see
   * BranchSettingsService.bulkSetWeekendDays' doc comment for why — holiday-
   * specific displays/reports check isHoliday, not isWorkingDay), with the
   * master's real holiday name taking priority over the generic "Weekly
   * Holiday" label when a date is both. This keeps publish from reverting a
   * branch's weekend days back to isHoliday=false, which otherwise silently
   * undoes bulkSetWeekendDays every time publish runs afterward.
   */
  async publish(dto: PublishMasterCalendarDto) {
    const masterDays = await this.prisma.masterCalendarDay.findMany({
      where: { date: { gte: new Date(Date.UTC(dto.year, 0, 1)), lt: new Date(Date.UTC(dto.year + 1, 0, 1)) } },
      orderBy: { date: 'asc' },
    });
    if (masterDays.length === 0) {
      return { year: dto.year, branches: [] };
    }

    const branches = await this.prisma.branch.findMany({
      where: { isActive: true, ...(dto.branchIds && { id: { in: dto.branchIds } }) },
      select: { id: true },
    });

    const summaries: { branchId: string; created: number; updated: number; skipped: number }[] = [];

    for (const branch of branches) {
      const weekendDays = await this.getWeekendDays(branch.id);
      const existingRows = await this.prisma.calendarDay.findMany({
        where: {
          branchId: branch.id,
          date: { gte: masterDays[0].date, lte: masterDays[masterDays.length - 1].date },
        },
        select: { id: true, date: true, isCustomized: true },
      });
      const existingByDate = new Map(existingRows.map((r) => [r.date.getTime(), r]));

      // No interactive $transaction here — with up to 365 days per branch,
      // one sequential await-per-day inside a single held connection was
      // exactly the pattern that blew past HifdhService.bulkReschedule's
      // transaction timeout under load (see that fix). Each row here is
      // independently idempotent (publish is documented as safe to re-run),
      // so createMany + concurrent per-row updates is both faster and loses
      // nothing — a failure partway just leaves the remaining days to pick
      // up on the next publish.
      const toCreate: Prisma.CalendarDayCreateManyInput[] = [];
      const toUpdate: { id: string; data: Prisma.CalendarDayUpdateInput }[] = [];
      let skipped = 0;

      for (const masterDay of masterDays) {
        const existing = existingByDate.get(masterDay.date.getTime());
        const isWeekend = weekendDays.includes(masterDay.date.getUTCDay());
        const isHoliday = masterDay.isHoliday || isWeekend;
        const isWorkingDay = !isHoliday;
        const fields = {
          dayName: masterDay.dayName,
          weekNumber: masterDay.weekNumber,
          year: masterDay.year,
          isWorkingDay,
          isHoliday,
          holidayName: masterDay.holidayName ?? (isWeekend ? 'Weekly Holiday' : null),
          isEvent: masterDay.isEvent,
          eventName: masterDay.eventName,
          masterCalendarDayId: masterDay.id,
        };

        if (!existing) {
          toCreate.push({ branchId: branch.id, date: masterDay.date, ...fields, isCustomized: false });
        } else if (!existing.isCustomized) {
          toUpdate.push({ id: existing.id, data: fields });
        } else {
          skipped++;
        }
      }

      if (toCreate.length > 0) {
        await this.prisma.calendarDay.createMany({ data: toCreate });
      }
      await Promise.all(
        toUpdate.map((u) => this.prisma.calendarDay.update({ where: { id: u.id }, data: u.data })),
      );

      const created = toCreate.length;
      const updated = toUpdate.length;

      summaries.push({ branchId: branch.id, created, updated, skipped });
    }

    return { year: dto.year, branches: summaries };
  }
}
