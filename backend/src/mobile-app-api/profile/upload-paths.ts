import { join } from 'path';

/** Local-disk destination for uploaded profile avatars, served back out at /uploads/avatars/<file> (see main.ts). */
export const UPLOADS_DIR = join(process.cwd(), 'uploads', 'avatars');
