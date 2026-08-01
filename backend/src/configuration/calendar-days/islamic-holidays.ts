export interface IslamicHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

const LATITUDE = 11.2588;
const LONGITUDE = 75.7804;
const METHOD = 2;

// Combining diacritical marks block (U+0300-U+036F) — stripped after NFD
// decomposition so "Dhū al-Ḥijjah" / "Muḥarram" reduce to plain ASCII for
// matching.
const DIACRITICS_RE = /[̀-ͯ]/g;

function asciiFold(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS_RE, '').toLowerCase();
}

/**
 * Mirrors the legacy IslamicHolidaysService::fetchIslamicDatesForYear —
 * queries the AlAdhan Gregorian-to-Hijri calendar for each month and pulls
 * out Ramadan (hijri day 21-30, matching the legacy filter exactly, not the
 * "all 30 days" the legacy UI copy claims), the 2-day Eid ul-Fitr, Eid
 * ul-Adha, and Islamic New Year.
 */
export async function fetchIslamicHolidaysForYear(year: number): Promise<IslamicHoliday[]> {
  const holidays: IslamicHoliday[] = [];

  for (let month = 1; month <= 12; month++) {
    const url = `https://api.aladhan.com/v1/gToHCalendar/${month}/${year}?latitude=${LATITUDE}&longitude=${LONGITUDE}&method=${METHOD}`;
    let days: unknown[];
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const body = (await response.json()) as { data?: unknown[] };
      days = body.data ?? [];
    } catch {
      continue;
    }

    for (const day of days as Array<{
      gregorian: { date: string };
      hijri: { day: string; month: { en: string } };
    }>) {
      const [dd, mm, yyyy] = day.gregorian.date.split('-');
      const gregDate = `${yyyy}-${mm}-${dd}`;
      // The API returns diacritics (e.g. "Dhū al-Ḥijjah", "Muḥarram") —
      // toLowerCase() alone doesn't strip combining marks, so fold first.
      const monthName = asciiFold(day.hijri.month.en);
      const hijriDay = Number(day.hijri.day);

      if (monthName.includes('rama') && hijriDay >= 21 && hijriDay <= 30) {
        holidays.push({ date: gregDate, name: `Ramadan Day ${hijriDay}` });
      }
      if (monthName.includes('shaww') && (hijriDay === 1 || hijriDay === 2)) {
        holidays.push({ date: gregDate, name: `Eid ul-Fitr Day ${hijriDay}` });
      }
      if (monthName.includes('dhu') && monthName.includes('hijjah') && hijriDay === 10) {
        holidays.push({ date: gregDate, name: 'Eid ul-Adha (Bakrid)' });
      }
      if (monthName.includes('muharram') && hijriDay === 1) {
        holidays.push({ date: gregDate, name: 'Islamic New Year (Muharram)' });
      }
    }
  }

  return holidays;
}
