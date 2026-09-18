import { join } from 'path';

/** Local-disk destination for uploaded lesson-remark voice notes, served back out at /uploads/voice-notes/<file> (see main.ts). */
export const VOICE_NOTES_DIR = join(process.cwd(), 'uploads', 'voice-notes');
