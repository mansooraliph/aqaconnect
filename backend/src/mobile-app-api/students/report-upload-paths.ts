import { join } from 'path';

/** Local-disk destination for generated activity-report PDFs, served back out at /uploads/reports/<file> (see main.ts). */
export const REPORTS_DIR = join(process.cwd(), 'uploads', 'reports');
