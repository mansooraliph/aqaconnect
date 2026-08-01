-- Flatten SurahTargetSchedule (header) + SurahTarget (child day-rows) into a
-- single day-row table matching the legacy surah_target_schedules table.
-- Existing rows are test data from earlier verification and don't map onto
-- the new required fields (scheduleNo/stage/dayNumber/fromAyah/toAyah), so
-- they're cleared rather than backfilled.
DELETE FROM "SurahTarget";
DELETE FROM "SurahTargetSchedule";

-- CreateEnum
CREATE TYPE "ScheduleStage" AS ENUM ('HIFDH', 'DOURA', 'REVISION');

-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD');

-- CreateEnum
CREATE TYPE "SchedulePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- DropForeignKey
ALTER TABLE "SurahTarget" DROP CONSTRAINT "SurahTarget_surahTargetScheduleId_fkey";

-- AlterTable
ALTER TABLE "SurahTargetSchedule" DROP COLUMN "name",
DROP COLUMN "status",
DROP COLUMN "targetsPerDay",
ADD COLUMN     "dayNumber" INTEGER NOT NULL,
ADD COLUMN     "difficultyLevel" "DifficultyLevel",
ADD COLUMN     "estimatedDurationMinutes" INTEGER,
ADD COLUMN     "examName" TEXT,
ADD COLUMN     "fromAyah" INTEGER NOT NULL,
ADD COLUMN     "lineFrom" INTEGER,
ADD COLUMN     "lineTo" INTEGER,
ADD COLUMN     "pageNumberFrom" INTEGER,
ADD COLUMN     "pageNumberTo" INTEGER,
ADD COLUMN     "portionDescription" TEXT,
ADD COLUMN     "priority" "SchedulePriority",
ADD COLUMN     "scheduleNo" INTEGER NOT NULL,
ADD COLUMN     "scheduleType" TEXT,
ADD COLUMN     "stage" "ScheduleStage" NOT NULL,
ADD COLUMN     "toAyah" INTEGER NOT NULL;

-- DropTable
DROP TABLE "SurahTarget";

-- CreateIndex
CREATE INDEX "SurahTargetSchedule_scheduleNo_idx" ON "SurahTargetSchedule"("scheduleNo");

-- CreateIndex
CREATE UNIQUE INDEX "SurahTargetSchedule_scheduleNo_dayNumber_key" ON "SurahTargetSchedule"("scheduleNo", "dayNumber");
