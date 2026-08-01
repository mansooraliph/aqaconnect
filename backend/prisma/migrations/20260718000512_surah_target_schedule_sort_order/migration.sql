-- Preserve import/insertion order instead of resorting by dayNumber (a day
-- can have many rows and their original sequence matters). Backfill for any
-- existing rows using their creation order, then enforce NOT NULL.
DROP INDEX "SurahTargetSchedule_dayNumber_idx";

ALTER TABLE "SurahTargetSchedule" ADD COLUMN "sortOrder" INTEGER;

UPDATE "SurahTargetSchedule" t
SET "sortOrder" = sub.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") - 1 AS rn
  FROM "SurahTargetSchedule"
) sub
WHERE t."id" = sub."id";

ALTER TABLE "SurahTargetSchedule" ALTER COLUMN "sortOrder" SET NOT NULL;

CREATE INDEX "SurahTargetSchedule_sortOrder_idx" ON "SurahTargetSchedule"("sortOrder");
