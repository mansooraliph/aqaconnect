-- CreateEnum
CREATE TYPE "StudentExamMode" AS ENUM ('EXAM', 'MUKAMMAL');

-- AlterTable
ALTER TABLE "StudentExam" ADD COLUMN     "examMode" "StudentExamMode" NOT NULL DEFAULT 'EXAM',
ADD COLUMN     "juzNumbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
