-- academicYearId becomes optional: "Initiate Days" generates a full
-- Jan-Dec calendar year independent of any academic year, matching legacy.
ALTER TABLE "CalendarDay" ALTER COLUMN "academicYearId" DROP NOT NULL;
