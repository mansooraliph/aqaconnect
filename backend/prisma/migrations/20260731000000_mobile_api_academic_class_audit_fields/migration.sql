-- AlterTable
ALTER TABLE "AcademicClass" ADD COLUMN     "addedById" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "lastUpdatedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AcademicClass_branchId_code_key" ON "AcademicClass"("branchId", "code");

-- AddForeignKey
ALTER TABLE "AcademicClass" ADD CONSTRAINT "AcademicClass_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicClass" ADD CONSTRAINT "AcademicClass_lastUpdatedById_fkey" FOREIGN KEY ("lastUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

