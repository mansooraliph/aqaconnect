-- CreateEnum
CREATE TYPE "LessonProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "HifdhProgressStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "ExamResultStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "lessonStageId" TEXT NOT NULL,
    "lessonSubStageId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentLessonProgress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "status" "LessonProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Halqa" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacherId" TEXT,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Halqa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HalqaStudent" (
    "id" TEXT NOT NULL,
    "halqaId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "HalqaStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurahHifdhStudentSchedule" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "surahId" TEXT NOT NULL,
    "teacherId" TEXT,
    "fromAyah" INTEGER NOT NULL,
    "toAyah" INTEGER NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "rescheduledFromId" TEXT,
    "status" "HifdhProgressStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurahHifdhStudentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSurahProgress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "surahId" TEXT NOT NULL,
    "ayahsCompleted" INTEGER NOT NULL DEFAULT 0,
    "status" "HifdhProgressStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentSurahProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamType" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "examTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examDate" DATE NOT NULL,
    "maxMarks" DECIMAL(6,2) NOT NULL DEFAULT 100,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentExamResult" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "marksObtained" DECIMAL(6,2) NOT NULL,
    "remark" TEXT,
    "status" "ExamResultStatus" NOT NULL DEFAULT 'DRAFT',
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lesson_branchId_lessonStageId_sortOrder_idx" ON "Lesson"("branchId", "lessonStageId", "sortOrder");

-- CreateIndex
CREATE INDEX "Lesson_lessonSubStageId_idx" ON "Lesson"("lessonSubStageId");

-- CreateIndex
CREATE INDEX "StudentLessonProgress_studentId_status_idx" ON "StudentLessonProgress"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentLessonProgress_studentId_lessonId_key" ON "StudentLessonProgress"("studentId", "lessonId");

-- CreateIndex
CREATE INDEX "Halqa_branchId_idx" ON "Halqa"("branchId");

-- CreateIndex
CREATE INDEX "Halqa_teacherId_idx" ON "Halqa"("teacherId");

-- CreateIndex
CREATE INDEX "HalqaStudent_studentId_idx" ON "HalqaStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "HalqaStudent_halqaId_studentId_key" ON "HalqaStudent"("halqaId", "studentId");

-- CreateIndex
CREATE INDEX "SurahHifdhStudentSchedule_studentId_status_idx" ON "SurahHifdhStudentSchedule"("studentId", "status");

-- CreateIndex
CREATE INDEX "SurahHifdhStudentSchedule_surahId_idx" ON "SurahHifdhStudentSchedule"("surahId");

-- CreateIndex
CREATE INDEX "SurahHifdhStudentSchedule_teacherId_idx" ON "SurahHifdhStudentSchedule"("teacherId");

-- CreateIndex
CREATE INDEX "StudentSurahProgress_studentId_status_idx" ON "StudentSurahProgress"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSurahProgress_studentId_surahId_key" ON "StudentSurahProgress"("studentId", "surahId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamType_branchId_name_key" ON "ExamType"("branchId", "name");

-- CreateIndex
CREATE INDEX "Exam_branchId_examTypeId_idx" ON "Exam"("branchId", "examTypeId");

-- CreateIndex
CREATE INDEX "StudentExamResult_studentId_idx" ON "StudentExamResult"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentExamResult_examId_studentId_key" ON "StudentExamResult"("examId", "studentId");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_lessonStageId_fkey" FOREIGN KEY ("lessonStageId") REFERENCES "LessonStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_lessonSubStageId_fkey" FOREIGN KEY ("lessonSubStageId") REFERENCES "LessonSubStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Halqa" ADD CONSTRAINT "Halqa_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Halqa" ADD CONSTRAINT "Halqa_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HalqaStudent" ADD CONSTRAINT "HalqaStudent_halqaId_fkey" FOREIGN KEY ("halqaId") REFERENCES "Halqa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HalqaStudent" ADD CONSTRAINT "HalqaStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurahHifdhStudentSchedule" ADD CONSTRAINT "SurahHifdhStudentSchedule_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurahHifdhStudentSchedule" ADD CONSTRAINT "SurahHifdhStudentSchedule_surahId_fkey" FOREIGN KEY ("surahId") REFERENCES "Surah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurahHifdhStudentSchedule" ADD CONSTRAINT "SurahHifdhStudentSchedule_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurahHifdhStudentSchedule" ADD CONSTRAINT "SurahHifdhStudentSchedule_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "SurahHifdhStudentSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSurahProgress" ADD CONSTRAINT "StudentSurahProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSurahProgress" ADD CONSTRAINT "StudentSurahProgress_surahId_fkey" FOREIGN KEY ("surahId") REFERENCES "Surah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSurahProgress" ADD CONSTRAINT "StudentSurahProgress_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamType" ADD CONSTRAINT "ExamType_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "ExamType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExamResult" ADD CONSTRAINT "StudentExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExamResult" ADD CONSTRAINT "StudentExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
