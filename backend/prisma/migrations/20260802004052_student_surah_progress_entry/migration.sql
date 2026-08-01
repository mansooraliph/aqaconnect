-- CreateEnum
CREATE TYPE "ProgressEntryType" AS ENUM ('NEW_LESSON', 'JUZH_LESSON', 'OLD_LESSON');

-- CreateEnum
CREATE TYPE "ProgressEntryStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "ProgressEntryGrade" AS ENUM ('VERY_GOOD', 'GOOD', 'AVERAGE', 'BAD');

-- CreateTable
CREATE TABLE "StudentSurahProgressEntry" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "surahId" TEXT,
    "fromAyah" INTEGER,
    "toAyah" INTEGER,
    "type" "ProgressEntryType",
    "status" "ProgressEntryStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "grade" "ProgressEntryGrade",
    "completedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "remarkFile" TEXT,
    "surahFrom" INTEGER,
    "surahFromAyah" INTEGER,
    "surahTo" INTEGER,
    "surahToAyah" INTEGER,
    "juzuhFrom" INTEGER,
    "juzuhTo" INTEGER,
    "pageFrom" INTEGER,
    "pageTo" INTEGER,
    "addedById" TEXT,
    "lastUpdatedById" TEXT,
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentSurahProgressEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentSurahProgressEntry_branchId_idx" ON "StudentSurahProgressEntry"("branchId");

-- CreateIndex
CREATE INDEX "StudentSurahProgressEntry_studentId_surahId_idx" ON "StudentSurahProgressEntry"("studentId", "surahId");

-- CreateIndex
CREATE INDEX "StudentSurahProgressEntry_studentId_type_idx" ON "StudentSurahProgressEntry"("studentId", "type");

-- CreateIndex
CREATE INDEX "StudentSurahProgressEntry_studentId_status_idx" ON "StudentSurahProgressEntry"("studentId", "status");

-- AddForeignKey
ALTER TABLE "StudentSurahProgressEntry" ADD CONSTRAINT "StudentSurahProgressEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSurahProgressEntry" ADD CONSTRAINT "StudentSurahProgressEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSurahProgressEntry" ADD CONSTRAINT "StudentSurahProgressEntry_surahId_fkey" FOREIGN KEY ("surahId") REFERENCES "Surah"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSurahProgressEntry" ADD CONSTRAINT "StudentSurahProgressEntry_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSurahProgressEntry" ADD CONSTRAINT "StudentSurahProgressEntry_lastUpdatedById_fkey" FOREIGN KEY ("lastUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSurahProgressEntry" ADD CONSTRAINT "StudentSurahProgressEntry_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

