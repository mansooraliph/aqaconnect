-- CreateEnum
CREATE TYPE "StudentStage" AS ENUM ('STAGE_3', 'STAGE_4');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "stage" "StudentStage" NOT NULL DEFAULT 'STAGE_3';
