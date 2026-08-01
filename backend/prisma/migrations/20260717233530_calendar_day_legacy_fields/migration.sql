-- Add legacy calendar_days columns (day_name/week_number/year/holiday_name)
-- and drop the holidayId -> Holiday FK per explicit instruction (this table
-- no longer links to Holiday; holidayName is a plain text column instead).
ALTER TABLE "CalendarDay" ADD COLUMN     "dayName" TEXT,
ADD COLUMN     "holidayName" TEXT,
ADD COLUMN     "weekNumber" INTEGER,
ADD COLUMN     "year" INTEGER;

-- Backfill holidayName from the linked Holiday before dropping holidayId,
-- so existing links aren't silently lost.
UPDATE "CalendarDay" cd
SET "holidayName" = h."name"
FROM "Holiday" h
WHERE cd."holidayId" = h."id";

-- Backfill the new derived columns for existing rows.
UPDATE "CalendarDay"
SET "year" = EXTRACT(YEAR FROM "date")::int,
    "weekNumber" = EXTRACT(WEEK FROM "date")::int,
    "dayName" = TO_CHAR("date", 'FMDay');

ALTER TABLE "CalendarDay" DROP CONSTRAINT "CalendarDay_holidayId_fkey";
DROP INDEX "CalendarDay_holidayId_idx";
ALTER TABLE "CalendarDay" DROP COLUMN "holidayId";
