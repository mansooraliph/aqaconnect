-- CreateEnum
CREATE TYPE "RevelationType" AS ENUM ('MAKKI', 'MADANI');

-- AlterTable: add legacy juz/page/line range columns
ALTER TABLE "Surah" ADD COLUMN     "juzFrom" INTEGER,
ADD COLUMN     "juzTo" INTEGER,
ADD COLUMN     "lineNumberFrom" INTEGER,
ADD COLUMN     "lineNumberTo" INTEGER,
ADD COLUMN     "pageNumberFrom" INTEGER,
ADD COLUMN     "pageNumberTo" INTEGER;

-- Convert revelationType from free-text to the RevelationType enum,
-- preserving existing data (Meccan/Meccan-like -> MAKKI, Medinan -> MADANI).
ALTER TABLE "Surah" ADD COLUMN "revelationTypeNew" "RevelationType";

UPDATE "Surah"
SET "revelationTypeNew" = CASE
  WHEN "revelationType" = 'Meccan' THEN 'MAKKI'::"RevelationType"
  WHEN "revelationType" = 'Medinan' THEN 'MADANI'::"RevelationType"
  ELSE NULL
END;

ALTER TABLE "Surah" DROP COLUMN "revelationType";
ALTER TABLE "Surah" RENAME COLUMN "revelationTypeNew" TO "revelationType";
