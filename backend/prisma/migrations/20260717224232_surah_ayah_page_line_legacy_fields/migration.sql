-- AlterTable: replace single lineNumber with a lineFrom/lineTo range and add
-- juzNumber, matching the legacy surah_ayah_page_lines table. Table is empty
-- in every environment so far, so a straight drop/add is safe.
ALTER TABLE "SurahAyahPageLine" DROP COLUMN "lineNumber",
ADD COLUMN     "juzNumber" INTEGER,
ADD COLUMN     "lineFrom" INTEGER NOT NULL,
ADD COLUMN     "lineTo" INTEGER NOT NULL;
