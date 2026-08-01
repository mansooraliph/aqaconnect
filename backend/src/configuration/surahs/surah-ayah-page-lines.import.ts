import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

export interface PageLineImportRow {
  surahNumber: number;
  ayahNumber: number;
  juzNumber: number | null;
  pageNumber: number;
  lineNo: number;
}

/**
 * Parses a Surah/Ayah/Page/Line workbook: expected columns (in order, header
 * row 1) are Sura No, Sura Name, Ayath No, Juzh No, Page No, Line No —
 * matching the "Aqa_Quran_page_lines.xlsx" reference file. Sura Name is
 * ignored (surahs are matched by number, not name).
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
    const lineNo = row.getCell(6).value;

    if (suraNo === null || suraNo === undefined || suraNo === '') return; // skip blank rows

    const surahNumber = Number(suraNo);
    const ayahNumber = Number(ayahNo);
    const pageNumber = Number(pageNo);
    const lineNumber = Number(lineNo);

    if (!Number.isInteger(surahNumber) || surahNumber < 1) {
      throw new BadRequestException(`Row ${rowNumber}: "Sura No" must be a positive integer`);
    }
    if (!Number.isInteger(ayahNumber) || ayahNumber < 1) {
      throw new BadRequestException(`Row ${rowNumber}: "Ayath No" must be a positive integer`);
    }
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new BadRequestException(`Row ${rowNumber}: "Page No" must be a positive integer`);
    }
    if (!Number.isInteger(lineNumber) || lineNumber < 1) {
      throw new BadRequestException(`Row ${rowNumber}: "Line No" must be a positive integer`);
    }

    rows.push({
      surahNumber,
      ayahNumber,
      juzNumber: typeof juzNo === 'number' ? juzNo : null,
      pageNumber,
      lineNo: lineNumber,
    });
  });

  return rows;
}
