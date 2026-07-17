import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { ApplyToCalendarDto } from './dto/apply-to-calendar.dto';

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  /** UTC date-only, matching the `@db.Date` column (no time component). */
  private dateOnly(input: string | Date) {
    const source = new Date(input);
    return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
  }

  list(branchId: string) {
    return this.prisma.holiday.findMany({ where: { branchId }, orderBy: { date: 'asc' } });
  }

  async findOne(branchId: string, id: string) {
    const record = await this.prisma.holiday.findFirst({ where: { id, branchId } });
    if (!record) {
      throw new NotFoundException('Holiday not found');
    }
    return record;
  }

  create(branchId: string, dto: CreateHolidayDto) {
    return this.prisma.holiday.create({
      data: {
        branchId,
        name: dto.name,
        date: this.dateOnly(dto.date),
        isRecurringYearly: dto.isRecurringYearly ?? false,
      },
    });
  }

  async update(branchId: string, id: string, dto: UpdateHolidayDto) {
    await this.findOne(branchId, id);
    return this.prisma.holiday.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.date !== undefined && { date: this.dateOnly(dto.date) }),
        ...(dto.isRecurringYearly !== undefined && { isRecurringYearly: dto.isRecurringYearly }),
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
  }

  /**
   * Closes the loop deferred from the Calendar Days generation step: links this
   * holiday to the CalendarDay row for its date. If Calendar Days generation
   * already created a row for [branchId, date] within the academic year, it is
   * updated in place; otherwise a new row is created for it (upsert keyed on
   * the CalendarDay [branchId, date] unique constraint).
   */
  async applyToCalendar(branchId: string, id: string, dto: ApplyToCalendarDto) {
    const holiday = await this.findOne(branchId, id);
    await this.assertAcademicYearBelongsToBranch(branchId, dto.academicYearId);

    return this.prisma.calendarDay.upsert({
      where: { branchId_date: { branchId, date: holiday.date } },
      create: {
        branchId,
        academicYearId: dto.academicYearId,
        date: holiday.date,
        isWorkingDay: false,
        isHoliday: true,
        holidayId: holiday.id,
      },
      update: {
        isWorkingDay: false,
        isHoliday: true,
        holidayId: holiday.id,
      },
    });
  }
}
