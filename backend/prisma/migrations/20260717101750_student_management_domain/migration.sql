-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'WITHDRAWN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StudentLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Admission" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "guardianName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "dateOfBirth" DATE,
    "desiredClassId" TEXT,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdStudentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "branchId" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "admissionId" TEXT,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicClassSectionYearId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transferredFromId" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentLeave" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "leaveDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "leaveType" TEXT,
    "status" "StudentLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "creationRemarks" TEXT,
    "approvalRemarks" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentLeave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Admission_branchId_status_idx" ON "Admission"("branchId", "status");

-- CreateIndex
CREATE INDEX "Admission_desiredClassId_idx" ON "Admission"("desiredClassId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_admissionId_key" ON "Student"("admissionId");

-- CreateIndex
CREATE INDEX "Student_branchId_status_idx" ON "Student"("branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Student_branchId_studentCode_key" ON "Student"("branchId", "studentCode");

-- CreateIndex
CREATE INDEX "StudentEnrollment_academicClassSectionYearId_status_idx" ON "StudentEnrollment"("academicClassSectionYearId", "status");

-- CreateIndex
CREATE INDEX "StudentEnrollment_studentId_idx" ON "StudentEnrollment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrollment_studentId_academicClassSectionYearId_key" ON "StudentEnrollment"("studentId", "academicClassSectionYearId");

-- CreateIndex
CREATE INDEX "StudentLeave_branchId_status_idx" ON "StudentLeave"("branchId", "status");

-- CreateIndex
CREATE INDEX "StudentLeave_studentId_leaveDate_idx" ON "StudentLeave"("studentId", "leaveDate");

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_desiredClassId_fkey" FOREIGN KEY ("desiredClassId") REFERENCES "AcademicClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_academicClassSectionYearId_fkey" FOREIGN KEY ("academicClassSectionYearId") REFERENCES "AcademicClassSectionYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_transferredFromId_fkey" FOREIGN KEY ("transferredFromId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLeave" ADD CONSTRAINT "StudentLeave_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLeave" ADD CONSTRAINT "StudentLeave_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
