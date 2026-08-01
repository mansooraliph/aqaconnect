-- Collapse Student.firstName/lastName into a single Student.name column.
ALTER TABLE "Student" ADD COLUMN "name" TEXT;

UPDATE "Student" SET "name" = TRIM(BOTH ' ' FROM ("firstName" || ' ' || "lastName"));

ALTER TABLE "Student" ALTER COLUMN "name" SET NOT NULL;

ALTER TABLE "Student" DROP COLUMN "firstName";
ALTER TABLE "Student" DROP COLUMN "lastName";
