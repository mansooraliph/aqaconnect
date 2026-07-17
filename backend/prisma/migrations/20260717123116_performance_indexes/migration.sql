-- CreateIndex
CREATE INDEX "AcademicClassSection_academicSectionId_idx" ON "AcademicClassSection"("academicSectionId");

-- CreateIndex
CREATE INDEX "FeeDemand_feeStructureId_idx" ON "FeeDemand"("feeStructureId");

-- CreateIndex
CREATE INDEX "StudentLessonProgress_lessonId_idx" ON "StudentLessonProgress"("lessonId");

-- CreateIndex
CREATE INDEX "StudentSurahProgress_surahId_idx" ON "StudentSurahProgress"("surahId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");
