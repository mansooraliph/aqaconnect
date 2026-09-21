-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'TEACHERS', 'STUDENTS');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL';
