-- CreateEnum
CREATE TYPE "ActiveStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "BranchSettings" ADD COLUMN     "academicYearId" TEXT;

-- CreateTable
CREATE TABLE "LessonStage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonSubStage" (
    "id" TEXT NOT NULL,
    "lessonStageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonSubStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Surah" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "nameArabic" TEXT NOT NULL,
    "nameEnglish" TEXT NOT NULL,
    "totalAyahs" INTEGER NOT NULL,
    "revelationType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Surah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuranPage" (
    "id" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "lineCount" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuranPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurahAyahPageLine" (
    "id" TEXT NOT NULL,
    "surahId" TEXT NOT NULL,
    "ayahNumber" INTEGER NOT NULL,
    "quranPageId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurahAyahPageLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurahTargetSchedule" (
    "id" TEXT NOT NULL,
    "surahId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetsPerDay" INTEGER NOT NULL DEFAULT 1,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurahTargetSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurahTarget" (
    "id" TEXT NOT NULL,
    "surahTargetScheduleId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "fromAyah" INTEGER NOT NULL,
    "toAyah" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurahTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicClass" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicSection" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicClassSection" (
    "id" TEXT NOT NULL,
    "academicClassId" TEXT NOT NULL,
    "academicSectionId" TEXT NOT NULL,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicClassSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicClassSectionYear" (
    "id" TEXT NOT NULL,
    "academicClassSectionId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "capacity" INTEGER,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicClassSectionYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarDay" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonStage_sortOrder_idx" ON "LessonStage"("sortOrder");

-- CreateIndex
CREATE INDEX "LessonSubStage_lessonStageId_sortOrder_idx" ON "LessonSubStage"("lessonStageId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Surah_number_key" ON "Surah"("number");

-- CreateIndex
CREATE INDEX "Surah_number_idx" ON "Surah"("number");

-- CreateIndex
CREATE UNIQUE INDEX "QuranPage_pageNumber_key" ON "QuranPage"("pageNumber");

-- CreateIndex
CREATE INDEX "SurahAyahPageLine_quranPageId_idx" ON "SurahAyahPageLine"("quranPageId");

-- CreateIndex
CREATE UNIQUE INDEX "SurahAyahPageLine_surahId_ayahNumber_key" ON "SurahAyahPageLine"("surahId", "ayahNumber");

-- CreateIndex
CREATE INDEX "SurahTargetSchedule_surahId_idx" ON "SurahTargetSchedule"("surahId");

-- CreateIndex
CREATE UNIQUE INDEX "SurahTarget_surahTargetScheduleId_dayNumber_key" ON "SurahTarget"("surahTargetScheduleId", "dayNumber");

-- CreateIndex
CREATE INDEX "AcademicYear_branchId_isCurrent_idx" ON "AcademicYear"("branchId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_branchId_name_key" ON "AcademicYear"("branchId", "name");

-- CreateIndex
CREATE INDEX "AcademicClass_branchId_idx" ON "AcademicClass"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicClass_branchId_name_key" ON "AcademicClass"("branchId", "name");

-- CreateIndex
CREATE INDEX "AcademicSection_branchId_idx" ON "AcademicSection"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicSection_branchId_name_key" ON "AcademicSection"("branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicClassSection_academicClassId_academicSectionId_key" ON "AcademicClassSection"("academicClassId", "academicSectionId");

-- CreateIndex
CREATE INDEX "AcademicClassSectionYear_academicYearId_idx" ON "AcademicClassSectionYear"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicClassSectionYear_academicClassSectionId_academicYea_key" ON "AcademicClassSectionYear"("academicClassSectionId", "academicYearId");

-- CreateIndex
CREATE INDEX "CalendarDay_academicYearId_idx" ON "CalendarDay"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarDay_branchId_date_key" ON "CalendarDay"("branchId", "date");

-- CreateIndex
CREATE INDEX "BranchSettings_academicYearId_idx" ON "BranchSettings"("academicYearId");

-- AddForeignKey
ALTER TABLE "BranchSettings" ADD CONSTRAINT "BranchSettings_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSubStage" ADD CONSTRAINT "LessonSubStage_lessonStageId_fkey" FOREIGN KEY ("lessonStageId") REFERENCES "LessonStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurahAyahPageLine" ADD CONSTRAINT "SurahAyahPageLine_surahId_fkey" FOREIGN KEY ("surahId") REFERENCES "Surah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurahAyahPageLine" ADD CONSTRAINT "SurahAyahPageLine_quranPageId_fkey" FOREIGN KEY ("quranPageId") REFERENCES "QuranPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurahTargetSchedule" ADD CONSTRAINT "SurahTargetSchedule_surahId_fkey" FOREIGN KEY ("surahId") REFERENCES "Surah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurahTarget" ADD CONSTRAINT "SurahTarget_surahTargetScheduleId_fkey" FOREIGN KEY ("surahTargetScheduleId") REFERENCES "SurahTargetSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicClass" ADD CONSTRAINT "AcademicClass_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicSection" ADD CONSTRAINT "AcademicSection_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicClassSection" ADD CONSTRAINT "AcademicClassSection_academicClassId_fkey" FOREIGN KEY ("academicClassId") REFERENCES "AcademicClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicClassSection" ADD CONSTRAINT "AcademicClassSection_academicSectionId_fkey" FOREIGN KEY ("academicSectionId") REFERENCES "AcademicSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicClassSectionYear" ADD CONSTRAINT "AcademicClassSectionYear_academicClassSectionId_fkey" FOREIGN KEY ("academicClassSectionId") REFERENCES "AcademicClassSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicClassSectionYear" ADD CONSTRAINT "AcademicClassSectionYear_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarDay" ADD CONSTRAINT "CalendarDay_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarDay" ADD CONSTRAINT "CalendarDay_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
