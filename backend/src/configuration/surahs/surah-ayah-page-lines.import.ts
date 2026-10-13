import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

export interface PageLineImportRow {
  surahNumber: number;
  ayahNumber: number;
  juzNumber: number | null;
  pageNumber: number;
  lineFrom: number;
  lineTo: number;
}

/**
 * Parses a Surah/Ayah/Page/Line workbook: expected columns (in order, header
 * row 1) are Sura No, Sura Name, Ayath No, Juzh No, Page No, Line From,
 * Line To. Sura Name is ignored (surahs are matched by number, not name).
 *
 * Both line columns are REQUIRED and read verbatim from the sheet — this
 * used to accept just a single "Line No" (an ayah's ending line) and
 * derive its starting line by assuming it always continued from wherever
 * the previous ayah ended. That assumption was wrong for roughly a third
 * of the Quran (many ayahs start fresh on the next line rather than
 * sharing the previous ayah's last line), silently corrupting lineFrom
 * for those rows with no validation ever catching it. Importers must now
 * supply the real start/end line for each ayah; nothing is inferred.
 */
export async function parseSurahAyahPageLineWorkbook(buffer: Buffer): Promise<PageLineImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new BadRequestException('Workbook has no sheets');
  }

  const rows: PageLineImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header

    const suraNo = row.getCell(1).value;
    const ayahNo = row.getCell(3).value;
    const juzNo = row.getCell(4).value;
    const pageNo = row.getCell(5).value;
    const lineFromCell = row.getCell(6).value;
    const lineToCell = row.getCell(7).value;

    if (suraNo === null || suraNo === undefined || suraNo === '') return; // skip blank rows

    const surahNumber = Number(suraNo);
    const ayahNumber = Number(ayahNo);
    const pageNumber = Number(pageNo);
    const lineFrom = Number(lineFromCell);
    const lineTo = Number(lineToCell);

    if (!Number.isInteger(surahNumber) || surahNumber < 1) {
      throw new BadRequestException(`Row ${rowNumber}: "Sura No" must be a positive integer`);
    }
    if (!Number.isInteger(ayahNumber) || ayahNumber < 1) {
      throw new BadRequestException(`Row ${rowNumber}: "Ayath No" must be a positive integer`);
    }
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new BadRequestException(`Row ${rowNumber}: "Page No" must be a positive integer`);
    }
    if (!Number.isInteger(lineFrom) || lineFrom < 1) {
      throw new BadRequestException(`Row ${rowNumber}: "Line From" must be a positive integer`);
    }
    if (!Number.isInteger(lineTo) || lineTo < lineFrom) {
      throw new BadRequestException(`Row ${rowNumber}: "Line To" must be a positive integer >= "Line From"`);
    }

    rows.push({
      surahNumber,
      ayahNumber,
      juzNumber: typeof juzNo === 'number' ? juzNo : null,
      pageNumber,
      lineFrom,
      lineTo,
    });
  });

  return rows;
}
