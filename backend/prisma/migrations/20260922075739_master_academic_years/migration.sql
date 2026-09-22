-- AlterTable
ALTER TABLE "AcademicYear" ADD COLUMN     "isCustomized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "masterAcademicYearId" TEXT;

-- CreateTable
CREATE TABLE "MasterAcademicYear" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterAcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MasterAcademicYear_name_key" ON "MasterAcademicYear"("name");

-- CreateIndex
CREATE INDEX "AcademicYear_masterAcademicYearId_idx" ON "AcademicYear"("masterAcademicYearId");

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_masterAcademicYearId_fkey" FOREIGN KEY ("masterAcademicYearId") REFERENCES "MasterAcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every pre-existing AcademicYear row was created independently by
-- its own branch, never derived from a master template. Marking them all
-- "customized" means the first-ever master-academic-year publish only fills
-- in a branch's missing years and never silently overwrites what that
-- branch already set up. New rows created after this migration default to
-- isCustomized = false (see the column default above) so they stay in sync
-- with the master until a branch actually edits them.
UPDATE "AcademicYear" SET "isCustomized" = true;
