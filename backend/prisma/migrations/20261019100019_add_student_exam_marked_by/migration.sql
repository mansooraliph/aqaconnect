-- AlterTable
ALTER TABLE "StudentExam" ADD COLUMN     "markedById" TEXT;

-- AddForeignKey
ALTER TABLE "StudentExam" ADD CONSTRAINT "StudentExam_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
