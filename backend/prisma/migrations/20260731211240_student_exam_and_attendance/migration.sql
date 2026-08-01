-- CreateEnum
CREATE TYPE "StudentExamOutcome" AS ENUM ('PASS', 'FAIL', 'PREPARATION');

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "studentId" TEXT,
ALTER COLUMN "employeeId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "StudentExam" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examDate" DATE NOT NULL,
    "examId" TEXT,
    "result" "StudentExamOutcome",
    "marks" DECIMAL(5,2),
    "remarks" TEXT,
    "scheduleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentExam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentExam_branchId_idx" ON "StudentExam"("branchId");

-- CreateIndex
CREATE INDEX "StudentExam_studentId_idx" ON "StudentExam"("studentId");

-- CreateIndex
CREATE INDEX "Attendance_studentId_idx" ON "Attendance"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_date_key" ON "Attendance"("studentId", "date");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExam" ADD CONSTRAINT "StudentExam_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExam" ADD CONSTRAINT "StudentExam_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

