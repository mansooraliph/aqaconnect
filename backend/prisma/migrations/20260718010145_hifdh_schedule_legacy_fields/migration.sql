-- Expand SurahHifdhStudentSchedule to match the legacy
-- surah_hifd_student_schedules table (juz/page/line ranges, portion
-- description, quality/duration/revision tracking, halqa + surah-target
-- links). company_id/added_by/last_updated_by/deleted_at dropped, and
-- surah_number/surah_name/surah_name_en dropped in favor of the existing
-- surahId relation, matching the rest of this schema.
--
-- The status column moves to its own HifdhScheduleStatus enum (kept
-- separate from HifdhProgressStatus, still used by StudentSurahProgress)
-- with legacy's 4-stage vocabulary. Existing rows are remapped rather than
-- reset: IN_PROGRESS stays, COMPLETED -> NEEDS_REVIEW (student-done,
-- awaiting teacher check), VERIFIED -> COMPLETED (teacher-confirmed,
-- terminal) — preserving the exact prior gating logic under new names.

CREATE TYPE "HifdhScheduleStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'NEEDS_REVIEW', 'COMPLETED');
CREATE TYPE "MemorizationQuality" AS ENUM ('EXCELLENT', 'GOOD', 'AVERAGE', 'NEEDS_IMPROVEMENT', 'NOT_ASSESSED');

ALTER TABLE "SurahHifdhStudentSchedule" ADD COLUMN     "actualDurationMinutes" INTEGER,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completionDate" DATE,
ADD COLUMN     "completionPercentage" DOUBLE PRECISION,
ADD COLUMN     "difficultyLevel" "DifficultyLevel",
ADD COLUMN     "estimatedDurationMinutes" INTEGER,
ADD COLUMN     "examName" TEXT,
ADD COLUMN     "halqaId" TEXT,
ADD COLUMN     "lastRevisionDate" DATE,
ADD COLUMN     "lineFrom" INTEGER,
ADD COLUMN     "lineTo" INTEGER,
ADD COLUMN     "memorizationQuality" "MemorizationQuality",
ADD COLUMN     "nextRevisionDue" DATE,
ADD COLUMN     "pageNumberFrom" INTEGER,
ADD COLUMN     "pageNumberTo" INTEGER,
ADD COLUMN     "portionDescription" TEXT,
ADD COLUMN     "priority" "SchedulePriority",
ADD COLUMN     "revisionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduleType" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "studentNotes" TEXT,
ADD COLUMN     "surahTargetId" TEXT,
ADD COLUMN     "teacherNotes" TEXT;

-- Remap status onto the new enum, preserving existing data.
ALTER TABLE "SurahHifdhStudentSchedule" ADD COLUMN "statusNew" "HifdhScheduleStatus";

UPDATE "SurahHifdhStudentSchedule"
SET "statusNew" = CASE "status"::text
  WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::"HifdhScheduleStatus"
  WHEN 'COMPLETED' THEN 'NEEDS_REVIEW'::"HifdhScheduleStatus"
  WHEN 'VERIFIED' THEN 'COMPLETED'::"HifdhScheduleStatus"
  ELSE 'PENDING'::"HifdhScheduleStatus"
END;

ALTER TABLE "SurahHifdhStudentSchedule" ALTER COLUMN "statusNew" SET NOT NULL;
ALTER TABLE "SurahHifdhStudentSchedule" ALTER COLUMN "statusNew" SET DEFAULT 'PENDING';
ALTER TABLE "SurahHifdhStudentSchedule" DROP COLUMN "status";
ALTER TABLE "SurahHifdhStudentSchedule" RENAME COLUMN "statusNew" TO "status";

CREATE INDEX "SurahHifdhStudentSchedule_studentId_status_idx" ON "SurahHifdhStudentSchedule"("studentId", "status");
CREATE INDEX "SurahHifdhStudentSchedule_halqaId_idx" ON "SurahHifdhStudentSchedule"("halqaId");
CREATE INDEX "SurahHifdhStudentSchedule_surahTargetId_idx" ON "SurahHifdhStudentSchedule"("surahTargetId");

ALTER TABLE "SurahHifdhStudentSchedule" ADD CONSTRAINT "SurahHifdhStudentSchedule_halqaId_fkey" FOREIGN KEY ("halqaId") REFERENCES "Halqa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SurahHifdhStudentSchedule" ADD CONSTRAINT "SurahHifdhStudentSchedule_surahTargetId_fkey" FOREIGN KEY ("surahTargetId") REFERENCES "SurahTargetSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
