// Pure, prisma-free calendar math shared by CalendarDaysService (per-branch)
// and MasterCalendarService (the branch-less common calendar) — kept here so
// "Initiate Days" behaves identically for both instead of two copies drifting.

export const WEEKDAY_NUMBERS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** ISO-8601 week number for a UTC date-only value. */
export function isoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7; // Monday = 0
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diffDays = (target.getTime() - firstThursday.getTime()) / 86_400_000;
  return 1 + Math.round(diffDays / 7);
}

export function allDatesOfYear(year: number): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  while (cursor.getTime() <= end.getTime()) {
    dates.push(new Date(cursor.getTime()));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** Every occurrence of a weekday in the year — empty if the weekday name is unknown. */
export function weekdayDates(year: number, weekday: string): Date[] {
  const weekdayNumber = WEEKDAY_NUMBERS[weekday];
  if (weekdayNumber === undefined) return [];
  return allDatesOfYear(year).filter((d) => d.getUTCDay() === weekdayNumber);
}

/** Groups Saturdays/Sundays per month and resolves only the requested nth pair (1st/2nd/3rd/4th/last) per month. */
export function specificWeekendDates(
  year: number,
  selections: string[],
): { date: Date; label: string }[] {
  const results: { date: Date; label: string }[] = [];

  for (let month = 0; month < 12; month++) {
    const monthDates = allDatesOfYear(year).filter((d) => d.getUTCMonth() === month);
    const saturdays = monthDates.filter((d) => d.getUTCDay() === 6);
    const sundays = monthDates.filter((d) => d.getUTCDay() === 0);
    const pairs: Date[][] = saturdays
      .map((sat, i) => (sundays[i] ? [sat, sundays[i]] : null))
      .filter((p): p is Date[] => p !== null);

    for (const selection of selections) {
      let pair: Date[] | undefined;
      switch (selection) {
        case '1st':
          pair = pairs[0];
          break;
        case '2nd':
          pair = pairs[1];
          break;
        case '3rd':
          pair = pairs[2];
          break;
        case '4th':
          pair = pairs[3];
          break;
        case 'last':
          pair = pairs.length >= 5 ? pairs[pairs.length - 1] : undefined;
          break;
      }
      if (!pair) continue;

      const label = `${selection[0].toUpperCase()}${selection.slice(1)} Weekend`;
      for (const date of pair) results.push({ date, label });
    }
  }

  return results;
}
