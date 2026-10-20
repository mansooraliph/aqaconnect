-- Mukammal queue: a passed Mukammal exam sits in the queue for
-- Admin/Principal sign-off until verifiedById is set.
ALTER TABLE "StudentExam" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "StudentExam" ADD COLUMN "verifiedById" TEXT;

ALTER TABLE "StudentExam" ADD CONSTRAINT "StudentExam_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
