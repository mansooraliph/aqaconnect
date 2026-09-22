-- AlterTable
ALTER TABLE "CalendarDay" ADD COLUMN     "eventName" TEXT,
ADD COLUMN     "isCustomized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEvent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "masterCalendarDayId" TEXT;

-- CreateTable
CREATE TABLE "MasterCalendarDay" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dayName" TEXT,
    "weekNumber" INTEGER,
    "year" INTEGER,
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "holidayName" TEXT,
    "isEvent" BOOLEAN NOT NULL DEFAULT false,
    "eventName" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterCalendarDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MasterCalendarDay_date_key" ON "MasterCalendarDay"("date");

-- CreateIndex
CREATE INDEX "MasterCalendarDay_year_idx" ON "MasterCalendarDay"("year");

-- CreateIndex
CREATE INDEX "CalendarDay_masterCalendarDayId_idx" ON "CalendarDay"("masterCalendarDayId");

-- AddForeignKey
ALTER TABLE "CalendarDay" ADD CONSTRAINT "CalendarDay_masterCalendarDayId_fkey" FOREIGN KEY ("masterCalendarDayId") REFERENCES "MasterCalendarDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every pre-existing CalendarDay row was set up independently by
-- its own branch, never derived from a master calendar. Marking them all
-- "customized" means the first-ever master-calendar publish only fills in
-- a branch's missing dates and never silently overwrites what that branch
-- already configured. New rows created after this migration default to
-- isCustomized = false (see the column default above) so they stay in
-- sync with the master until a branch actually edits them.
UPDATE "CalendarDay" SET "isCustomized" = true;
