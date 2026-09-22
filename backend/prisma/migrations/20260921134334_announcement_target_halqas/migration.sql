-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "targetHalqaIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
