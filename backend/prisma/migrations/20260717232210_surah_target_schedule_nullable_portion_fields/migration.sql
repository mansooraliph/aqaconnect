-- Make surahId/fromAyah/toAyah/stage nullable: real import data includes
-- milestone rows ("Preparation day", "Exam Juz 30") with no surah portion.
-- Also drop the (scheduleNo,dayNumber) uniqueness — a real schedule can have
-- several rows per day (sabaq + multiple revision portions).
ALTER TABLE "SurahTargetSchedule" DROP CONSTRAINT "SurahTargetSchedule_surahId_fkey";

DROP INDEX "SurahTargetSchedule_scheduleNo_dayNumber_key";
DROP INDEX "SurahTargetSchedule_scheduleNo_idx";

ALTER TABLE "SurahTargetSchedule" ALTER COLUMN "surahId" DROP NOT NULL,
ALTER COLUMN "fromAyah" DROP NOT NULL,
ALTER COLUMN "stage" DROP NOT NULL,
ALTER COLUMN "toAyah" DROP NOT NULL;

CREATE INDEX "SurahTargetSchedule_scheduleNo_dayNumber_idx" ON "SurahTargetSchedule"("scheduleNo", "dayNumber");

ALTER TABLE "SurahTargetSchedule" ADD CONSTRAINT "SurahTargetSchedule_surahId_fkey" FOREIGN KEY ("surahId") REFERENCES "Surah"("id") ON DELETE SET NULL ON UPDATE CASCADE;
