-- Day-number within the master target schedule, mirroring
-- SurahHifdhStudentSchedule.day, so progress entry listings can be ordered
-- by actual schedule sequence instead of fromAyah alone.
ALTER TABLE "StudentSurahProgressEntry" ADD COLUMN     "day" INTEGER;
