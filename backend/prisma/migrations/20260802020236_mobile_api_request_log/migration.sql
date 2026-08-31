-- CreateTable
CREATE TABLE "MobileApiRequestLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "username" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MobileApiRequestLog_createdAt_idx" ON "MobileApiRequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "MobileApiRequestLog_userId_idx" ON "MobileApiRequestLog"("userId");

-- CreateIndex
CREATE INDEX "MobileApiRequestLog_path_idx" ON "MobileApiRequestLog"("path");

