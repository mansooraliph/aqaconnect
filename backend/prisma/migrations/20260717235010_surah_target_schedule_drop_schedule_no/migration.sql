-- Target Schedules is a single global master plan, not multiple selectable
-- schedules, per explicit instruction — drop the scheduleNo grouping column.
DROP INDEX "SurahTargetSchedule_scheduleNo_dayNumber_idx";
ALTER TABLE "SurahTargetSchedule" DROP COLUMN "scheduleNo";
CREATE INDEX "SurahTargetSchedule_dayNumber_idx" ON "SurahTargetSchedule"("dayNumber");
