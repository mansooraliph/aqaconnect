-- AlterTable
ALTER TABLE "Halqa" ADD COLUMN     "addedById" TEXT,
ADD COLUMN     "currentClassId" TEXT,
ADD COLUMN     "lastUpdatedById" TEXT,
ADD COLUMN     "startDate" DATE;

-- CreateIndex
CREATE INDEX "Halqa_currentClassId_idx" ON "Halqa"("currentClassId");

-- AddForeignKey
ALTER TABLE "Halqa" ADD CONSTRAINT "Halqa_currentClassId_fkey" FOREIGN KEY ("currentClassId") REFERENCES "AcademicClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Halqa" ADD CONSTRAINT "Halqa_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Halqa" ADD CONSTRAINT "Halqa_lastUpdatedById_fkey" FOREIGN KEY ("lastUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

