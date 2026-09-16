-- AlterTable
ALTER TABLE "HalqaStudent" ADD COLUMN     "isTemporary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "restoreToHalqaId" TEXT;

-- AddForeignKey
ALTER TABLE "HalqaStudent" ADD CONSTRAINT "HalqaStudent_restoreToHalqaId_fkey" FOREIGN KEY ("restoreToHalqaId") REFERENCES "Halqa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
