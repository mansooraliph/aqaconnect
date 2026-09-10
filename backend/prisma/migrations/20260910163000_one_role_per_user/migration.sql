-- Enforce one role per user: drop the old compound-unique constraint that
-- allowed multiple UserRole rows per user, add a unique constraint on
-- userId alone (which supersedes the old plain index on userId).
DROP INDEX IF EXISTS "UserRole_userId_roleId_branchId_key";
DROP INDEX IF EXISTS "UserRole_userId_idx";

CREATE UNIQUE INDEX "UserRole_userId_key" ON "UserRole"("userId");
