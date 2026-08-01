-- AlterTable
ALTER TABLE "SurahHifdhStudentSchedule" ADD COLUMN     "scheduleNo" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "SurahHifdhStudentSchedule_studentId_scheduleNo_idx" ON "SurahHifdhStudentSchedule"("studentId", "scheduleNo");

