-- Login switches from email to username: email becomes optional, lastName
-- becomes optional, and a new required unique `username` is added. Backfill
-- existing users' username from their email's local-part, deduplicating
-- with a numeric suffix where needed.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "lastName" DROP NOT NULL;

WITH base AS (
  SELECT "id", split_part(COALESCE("email", "id"), '@', 1) AS candidate
  FROM "User"
),
numbered AS (
  SELECT "id", candidate,
         ROW_NUMBER() OVER (PARTITION BY candidate ORDER BY "id") AS rn
  FROM base
)
UPDATE "User" u
SET "username" = CASE WHEN n.rn = 1 THEN n.candidate ELSE n.candidate || '_' || n.rn END
FROM numbered n
WHERE u."id" = n."id";

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
