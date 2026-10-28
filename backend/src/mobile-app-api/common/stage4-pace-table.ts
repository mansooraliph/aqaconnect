/**
 * Stage 4 ("المراجعة" — revision) daily-pace schedule, 140 days, sourced
 * from "Stage 4 Target 23-06-2026.xlsx". Each entry is the TARGET number of
 * Juz' the student should revise THAT DAY (not a cumulative total, and not
 * which specific Juz' to revise) — an accelerating series of full 30-Juz'
 * revision cycles: 1 Juz'/day (one cycle every 30 days), then 1.5 Juz'/day
 * (one cycle every 20 days), then 2 Juz'/day (every 15 days), settling at
 * 3 Juz'/day (every 10 days) as the steady-state pace for the remainder of
 * the 140 days. `examLabel` days are "Doura" checkpoint/exam days with no
 * revision pace target of their own.
 *
 * Day 1 = the day a student is switched into Stage 4 (Student.stage4StartedAt).
 * Days beyond 140 are not covered by this table — see
 * `stage4PaceForDay` for how that's handled (holds at the last pace).
 */
export interface Stage4PaceDay {
  day: number;
  paceJuzPerDay: number | null;
  examLabel: string | null;
}

export const STAGE_4_PACE_TABLE: Stage4PaceDay[] = [
  { day: 1, paceJuzPerDay: 1.0, examLabel: null },
  { day: 2, paceJuzPerDay: 1.0, examLabel: null },
  { day: 3, paceJuzPerDay: 1.0, examLabel: null },
  { day: 4, paceJuzPerDay: 1.0, examLabel: null },
  { day: 5, paceJuzPerDay: 1.0, examLabel: null },
  { day: 6, paceJuzPerDay: 1.0, examLabel: null },
  { day: 7, paceJuzPerDay: 1.0, examLabel: null },
  { day: 8, paceJuzPerDay: 1.0, examLabel: null },
  { day: 9, paceJuzPerDay: 1.0, examLabel: null },
  { day: 10, paceJuzPerDay: 1.0, examLabel: null },
  { day: 11, paceJuzPerDay: 1.0, examLabel: null },
  { day: 12, paceJuzPerDay: 1.0, examLabel: null },
  { day: 13, paceJuzPerDay: 1.0, examLabel: null },
  { day: 14, paceJuzPerDay: 1.0, examLabel: null },
  { day: 15, paceJuzPerDay: 1.0, examLabel: null },
  { day: 16, paceJuzPerDay: 1.0, examLabel: null },
  { day: 17, paceJuzPerDay: 1.0, examLabel: null },
  { day: 18, paceJuzPerDay: 1.0, examLabel: null },
  { day: 19, paceJuzPerDay: 1.0, examLabel: null },
  { day: 20, paceJuzPerDay: 1.0, examLabel: null },
  { day: 21, paceJuzPerDay: 1.0, examLabel: null },
  { day: 22, paceJuzPerDay: 1.0, examLabel: null },
  { day: 23, paceJuzPerDay: 1.0, examLabel: null },
  { day: 24, paceJuzPerDay: 1.0, examLabel: null },
  { day: 25, paceJuzPerDay: 1.0, examLabel: null },
  { day: 26, paceJuzPerDay: 1.0, examLabel: null },
  { day: 27, paceJuzPerDay: 1.0, examLabel: null },
  { day: 28, paceJuzPerDay: 1.0, examLabel: null },
  { day: 29, paceJuzPerDay: 1.0, examLabel: null },
  { day: 30, paceJuzPerDay: 1.0, examLabel: null },
  { day: 31, paceJuzPerDay: null, examLabel: 'Exam Doura 1' },
  { day: 32, paceJuzPerDay: 1.5, examLabel: null },
  { day: 33, paceJuzPerDay: 1.5, examLabel: null },
  { day: 34, paceJuzPerDay: 1.5, examLabel: null },
  { day: 35, paceJuzPerDay: 1.5, examLabel: null },
  { day: 36, paceJuzPerDay: 1.5, examLabel: null },
  { day: 37, paceJuzPerDay: 1.5, examLabel: null },
  { day: 38, paceJuzPerDay: 1.5, examLabel: null },
  { day: 39, paceJuzPerDay: 1.5, examLabel: null },
  { day: 40, paceJuzPerDay: 1.5, examLabel: null },
  { day: 41, paceJuzPerDay: 1.5, examLabel: null },
  { day: 42, paceJuzPerDay: 1.5, examLabel: null },
  { day: 43, paceJuzPerDay: 1.5, examLabel: null },
  { day: 44, paceJuzPerDay: 1.5, examLabel: null },
  { day: 45, paceJuzPerDay: 1.5, examLabel: null },
  { day: 46, paceJuzPerDay: 1.5, examLabel: null },
  { day: 47, paceJuzPerDay: 1.5, examLabel: null },
  { day: 48, paceJuzPerDay: 1.5, examLabel: null },
  { day: 49, paceJuzPerDay: 1.5, examLabel: null },
  { day: 50, paceJuzPerDay: 1.5, examLabel: null },
  { day: 51, paceJuzPerDay: 1.5, examLabel: null },
  { day: 52, paceJuzPerDay: 2.0, examLabel: null },
  { day: 53, paceJuzPerDay: 2.0, examLabel: null },
  { day: 54, paceJuzPerDay: 2.0, examLabel: null },
  { day: 55, paceJuzPerDay: 2.0, examLabel: null },
  { day: 56, paceJuzPerDay: 2.0, examLabel: null },
  { day: 57, paceJuzPerDay: 2.0, examLabel: null },
  { day: 58, paceJuzPerDay: 2.0, examLabel: null },
  { day: 59, paceJuzPerDay: 2.0, examLabel: null },
  { day: 60, paceJuzPerDay: 2.0, examLabel: null },
  { day: 61, paceJuzPerDay: 2.0, examLabel: null },
  { day: 62, paceJuzPerDay: 2.0, examLabel: null },
  { day: 63, paceJuzPerDay: 2.0, examLabel: null },
  { day: 64, paceJuzPerDay: 2.0, examLabel: null },
  { day: 65, paceJuzPerDay: 2.0, examLabel: null },
  { day: 66, paceJuzPerDay: 2.0, examLabel: null },
  { day: 67, paceJuzPerDay: null, examLabel: 'Exam Doura 3' },
  { day: 68, paceJuzPerDay: 3.0, examLabel: null },
  { day: 69, paceJuzPerDay: 3.0, examLabel: null },
  { day: 70, paceJuzPerDay: 3.0, examLabel: null },
  { day: 71, paceJuzPerDay: 3.0, examLabel: null },
  { day: 72, paceJuzPerDay: 3.0, examLabel: null },
  { day: 73, paceJuzPerDay: 3.0, examLabel: null },
  { day: 74, paceJuzPerDay: 3.0, examLabel: null },
  { day: 75, paceJuzPerDay: 3.0, examLabel: null },
  { day: 76, paceJuzPerDay: 3.0, examLabel: null },
  { day: 77, paceJuzPerDay: 3.0, examLabel: null },
  { day: 78, paceJuzPerDay: 3.0, examLabel: null },
  { day: 79, paceJuzPerDay: 3.0, examLabel: null },
  { day: 80, paceJuzPerDay: 3.0, examLabel: null },
  { day: 81, paceJuzPerDay: 3.0, examLabel: null },
  { day: 82, paceJuzPerDay: 3.0, examLabel: null },
  { day: 83, paceJuzPerDay: 3.0, examLabel: null },
  { day: 84, paceJuzPerDay: 3.0, examLabel: null },
  { day: 85, paceJuzPerDay: 3.0, examLabel: null },
  { day: 86, paceJuzPerDay: 3.0, examLabel: null },
  { day: 87, paceJuzPerDay: 3.0, examLabel: null },
  { day: 88, paceJuzPerDay: null, examLabel: 'Exam Doura 5' },
  { day: 89, paceJuzPerDay: 3.0, examLabel: null },
  { day: 90, paceJuzPerDay: 3.0, examLabel: null },
  { day: 91, paceJuzPerDay: 3.0, examLabel: null },
  { day: 92, paceJuzPerDay: 3.0, examLabel: null },
  { day: 93, paceJuzPerDay: 3.0, examLabel: null },
  { day: 94, paceJuzPerDay: 3.0, examLabel: null },
  { day: 95, paceJuzPerDay: 3.0, examLabel: null },
  { day: 96, paceJuzPerDay: 3.0, examLabel: null },
  { day: 97, paceJuzPerDay: 3.0, examLabel: null },
  { day: 98, paceJuzPerDay: 3.0, examLabel: null },
  { day: 99, paceJuzPerDay: 3.0, examLabel: null },
  { day: 100, paceJuzPerDay: 3.0, examLabel: null },
  { day: 101, paceJuzPerDay: 3.0, examLabel: null },
  { day: 102, paceJuzPerDay: 3.0, examLabel: null },
  { day: 103, paceJuzPerDay: 3.0, examLabel: null },
  { day: 104, paceJuzPerDay: 3.0, examLabel: null },
  { day: 105, paceJuzPerDay: 3.0, examLabel: null },
  { day: 106, paceJuzPerDay: 3.0, examLabel: null },
  { day: 107, paceJuzPerDay: 3.0, examLabel: null },
  { day: 108, paceJuzPerDay: 3.0, examLabel: null },
  { day: 109, paceJuzPerDay: null, examLabel: 'Exam Doura 7' },
  { day: 110, paceJuzPerDay: 3.0, examLabel: null },
  { day: 111, paceJuzPerDay: 3.0, examLabel: null },
  { day: 112, paceJuzPerDay: 3.0, examLabel: null },
  { day: 113, paceJuzPerDay: 3.0, examLabel: null },
  { day: 114, paceJuzPerDay: 3.0, examLabel: null },
  { day: 115, paceJuzPerDay: 3.0, examLabel: null },
  { day: 116, paceJuzPerDay: 3.0, examLabel: null },
  { day: 117, paceJuzPerDay: 3.0, examLabel: null },
  { day: 118, paceJuzPerDay: 3.0, examLabel: null },
  { day: 119, paceJuzPerDay: 3.0, examLabel: null },
  { day: 120, paceJuzPerDay: 3.0, examLabel: null },
  { day: 121, paceJuzPerDay: 3.0, examLabel: null },
  { day: 122, paceJuzPerDay: 3.0, examLabel: null },
  { day: 123, paceJuzPerDay: 3.0, examLabel: null },
  { day: 124, paceJuzPerDay: 3.0, examLabel: null },
  { day: 125, paceJuzPerDay: 3.0, examLabel: null },
  { day: 126, paceJuzPerDay: 3.0, examLabel: null },
  { day: 127, paceJuzPerDay: 3.0, examLabel: null },
  { day: 128, paceJuzPerDay: 3.0, examLabel: null },
  { day: 129, paceJuzPerDay: 3.0, examLabel: null },
  { day: 130, paceJuzPerDay: null, examLabel: 'Exam Doura 9' },
  { day: 131, paceJuzPerDay: 3.0, examLabel: null },
  { day: 132, paceJuzPerDay: 3.0, examLabel: null },
  { day: 133, paceJuzPerDay: 3.0, examLabel: null },
  { day: 134, paceJuzPerDay: 3.0, examLabel: null },
  { day: 135, paceJuzPerDay: 3.0, examLabel: null },
  { day: 136, paceJuzPerDay: 3.0, examLabel: null },
  { day: 137, paceJuzPerDay: 3.0, examLabel: null },
  { day: 138, paceJuzPerDay: 3.0, examLabel: null },
  { day: 139, paceJuzPerDay: 3.0, examLabel: null },
  { day: 140, paceJuzPerDay: 3.0, examLabel: null },
];

/**
 * Pace for a given day-number (1-indexed, relative to stage4StartedAt).
 * day <= 0 returns the day-1 pace; day > 140 holds at the last defined
 * pace (3 Juz'/day) rather than falling off the end of the program —
 * Stage 4 doesn't have a defined "finished" day, the steady-state pace is
 * the ongoing expectation.
 */
export function stage4PaceForDay(day: number): Stage4PaceDay {
  if (day <= 1) return STAGE_4_PACE_TABLE[0];
  if (day > STAGE_4_PACE_TABLE.length) {
    const last = STAGE_4_PACE_TABLE[STAGE_4_PACE_TABLE.length - 1];
    return { day, paceJuzPerDay: last.paceJuzPerDay, examLabel: null };
  }
  return STAGE_4_PACE_TABLE[day - 1];
}

/** Days since stage4StartedAt, 1-indexed (the start day itself is day 1). */
export function stage4DayNumber(stage4StartedAt: Date, asOf: Date = new Date()): number {
  const startUtc = Date.UTC(stage4StartedAt.getUTCFullYear(), stage4StartedAt.getUTCMonth(), stage4StartedAt.getUTCDate());
  const asOfUtc = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  return Math.floor((asOfUtc - startUtc) / 86400000) + 1;
}
