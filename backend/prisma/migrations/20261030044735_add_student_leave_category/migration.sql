-- CreateEnum
CREATE TYPE "StudentLeaveCategory" AS ENUM ('GENERAL', 'SICK', 'SPECIAL');

-- AlterTable
ALTER TABLE "StudentLeave" ADD COLUMN     "category" "StudentLeaveCategory" NOT NULL DEFAULT 'GENERAL';
