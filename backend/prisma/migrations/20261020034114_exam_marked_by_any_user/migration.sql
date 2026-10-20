-- Attribute StudentExam.markedBy to any User (Teacher or Admin), not just
-- a Teacher profile. Most real exam entry happens via Admin logins, which
-- had no Teacher profile to attribute to.
ALTER TABLE "StudentExam" ADD COLUMN "markedByUserId" TEXT;

-- Backfill the handful of existing rows: convert the old Teacher.id
-- reference to the Teacher's own User.id.
UPDATE "StudentExam" se
SET "markedByUserId" = t."userId"
FROM "Teacher" t
WHERE se."markedById" = t."id";

ALTER TABLE "StudentExam" DROP CONSTRAINT "StudentExam_markedById_fkey";
ALTER TABLE "StudentExam" DROP COLUMN "markedById";

ALTER TABLE "StudentExam" ADD CONSTRAINT "StudentExam_markedByUserId_fkey" FOREIGN KEY ("markedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
