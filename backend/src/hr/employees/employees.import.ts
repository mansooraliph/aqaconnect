import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

export interface EmployeeImportRow {
  name: string;
  email: string | null;
  employeeCode: string | null;
  joiningDate: string | null; // YYYY-MM-DD
  isActive: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function excelDateToIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') {
    const match = /^\d{4}-\d{2}-\d{2}/.exec(value.trim());
    return match ? match[0] : null;
  }
  return null;
}

/**
 * Parses an employee export/import workbook: expected columns (by header,
 * order-independent) are "Employee" (full name), "Email", "Employee ID",
 * "Joining Date", "Status" — matching the "employees.xlsx" reference file.
 * Rows with no name are skipped. Email is only kept if it looks like a real
 * email (the reference file has placeholder values like "test").
 */
export async function parseEmployeesWorkbook(buffer: Buffer): Promise<EmployeeImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new BadRequestException('Workbook has no sheets');
  }

  const headerRow = sheet.getRow(1);
  const columnIndex: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const header = String(cell.value ?? '').trim().toLowerCase();
    if (header) columnIndex[header] = colNumber;
  });

  const nameCol = columnIndex['employee'] ?? columnIndex['name'];
  const emailCol = columnIndex['email'];
  const codeCol = columnIndex['employee id'] ?? columnIndex['employee code'];
  const joiningCol = columnIndex['joining date'];
  const statusCol = columnIndex['status'];

  if (!nameCol) {
    throw new BadRequestException('Workbook must have an "Employee" (or "Name") column');
  }

  const rows: EmployeeImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header

    const name = row.getCell(nameCol).value;
    if (name === null || name === undefined || String(name).trim() === '') return;

    const emailRaw = emailCol ? row.getCell(emailCol).value : null;
    const email = typeof emailRaw === 'string' && EMAIL_RE.test(emailRaw.trim()) ? emailRaw.trim() : null;

    const codeRaw = codeCol ? row.getCell(codeCol).value : null;
    const employeeCode = codeRaw !== null && codeRaw !== undefined && String(codeRaw).trim() !== '' ? String(codeRaw).trim() : null;

    const joiningDate = joiningCol ? excelDateToIso(row.getCell(joiningCol).value) : null;

    const statusRaw = statusCol ? String(row.getCell(statusCol).value ?? '').toLowerCase() : 'active';
    const isActive = !statusRaw.includes('inactive');

    rows.push({ name: String(name).trim(), email, employeeCode, joiningDate, isActive });
  });

  return rows;
}
