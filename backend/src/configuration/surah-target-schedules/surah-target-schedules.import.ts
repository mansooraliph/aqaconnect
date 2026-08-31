import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

export interface ImportRow {
  dayNumber: number;
  surahNumber: number | null;
  fromAyah: number | null;
  toAyah: number | null;
  scheduleType: string | null;
  /** The original text value of the surah/portion column when it isn't a
   * surah number (e.g. "Preparation day", "Exam Juz 30") — milestone rows
   * with no actual surah portion. */
  examName: string | null;
}

/**
 * Parses a Surah Target Schedule workbook: expected columns (in order,
 * header row 1) are day, surah no, ayah from, ayah to, type — matching the
 * "Aqa_Surah Target_Schedules.xlsx" reference file. The "type" column is
 * "Hifd" for normal memorization rows, or "Preparation"/"Exam" for milestone
 * rows. A row whose "surah no" cell isn't numeric (e.g. "Preparation day",
 * "Exam Juz 30") is treated as a milestone row: surahNumber/fromAyah/toAyah
 * come back null and the text goes into examName instead.
 */
export async function parseSurahTargetScheduleWorkbook(buffer: Buffer): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new BadRequestException('Workbook has no sheets');
  }

  const rows: ImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header

    const day = row.getCell(1).value;
    const surahCell = row.getCell(2).value;
    const ayahFrom = row.getCell(3).value;
    const ayahTo = row.getCell(4).value;
    const type = row.getCell(5).value;

    if (day === null || day === undefined || day === '') return; // skip blank rows

    const dayNumber = Number(day);
    if (!Number.isInteger(dayNumber) || dayNumber < 1) {
      throw new BadRequestException(`Row ${rowNumber}: "day" must be a positive integer`);
    }

    const surahNumber = typeof surahCell === 'number' ? surahCell : null;
    const examName = surahNumber === null && surahCell !== null && surahCell !== undefined ? String(surahCell) : null;

    rows.push({
      dayNumber,
      surahNumber,
      fromAyah: typeof ayahFrom === 'number' ? ayahFrom : null,
      toAyah: typeof ayahTo === 'number' ? ayahTo : null,
      scheduleType: type !== null && type !== undefined ? String(type) : null,
      examName,
    });
  });

  return rows;
}
