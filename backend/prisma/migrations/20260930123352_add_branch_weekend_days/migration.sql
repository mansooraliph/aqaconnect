-- AlterTable
ALTER TABLE "BranchSettings" ADD COLUMN     "weekendDays" INTEGER[] DEFAULT ARRAY[0, 6]::INTEGER[];
