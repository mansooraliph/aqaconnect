-- CreateIndex
CREATE INDEX "StudentSurahProgressEntry_branchId_status_completedAt_idx" ON "StudentSurahProgressEntry"("branchId", "status", "completedAt");

-- CreateIndex
CREATE INDEX "StudentSurahProgressEntry_studentId_status_completedAt_idx" ON "StudentSurahProgressEntry"("studentId", "status", "completedAt");
