-- CreateEnum
CREATE TYPE "BiometricUserType" AS ENUM ('STUDENT', 'TEACHER', 'STAFF');

-- CreateEnum
CREATE TYPE "BiometricEnrollmentStatus" AS ENUM ('PENDING', 'ENROLLED');

-- CreateEnum
CREATE TYPE "BiometricTemplateType" AS ENUM ('FP', 'FACE', 'PALM', 'USERPIC', 'BIOPHOTO');

-- CreateTable
CREATE TABLE "BiometricDevice" (
    "id" TEXT NOT NULL,
    "sn" TEXT NOT NULL,
    "alias" TEXT,
    "deviceType" TEXT NOT NULL DEFAULT 'iclock',
    "deviceModel" TEXT,
    "ipAddress" TEXT,
    "fwVer" TEXT,
    "pushVer" TEXT,
    "state" TEXT,
    "terminalTz" INTEGER,
    "userCount" INTEGER,
    "fpCount" INTEGER,
    "faceCount" INTEGER,
    "palmCount" INTEGER,
    "transactionCount" INTEGER,
    "pushTime" TEXT,
    "transferTime" TEXT,
    "transferInterval" INTEGER,
    "isAttendance" INTEGER,
    "area" TEXT,
    "areaId" INTEGER,
    "branchId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "assignedByUserId" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "deactivatedByUserId" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivationReason" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastActivity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiometricDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricDeviceCommand" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "sn" TEXT NOT NULL,
    "branchId" TEXT,
    "command" TEXT NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "deviceReturnCode" INTEGER,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiometricDeviceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricDeviceLog" (
    "id" TEXT NOT NULL,
    "sn" TEXT,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "tableName" TEXT,
    "data" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricDeviceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricEnrollment" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "studentId" TEXT,
    "employeeId" TEXT,
    "userType" "BiometricUserType",
    "name" TEXT,
    "status" "BiometricEnrollmentStatus",
    "deviceSn" TEXT,
    "type" "BiometricTemplateType" NOT NULL,
    "fId" TEXT,
    "faceId" TEXT,
    "index" TEXT NOT NULL DEFAULT '0',
    "tmp" TEXT,
    "image" TEXT,
    "no" TEXT,
    "valid" TEXT,
    "size" TEXT,
    "format" TEXT,
    "typeRaw" TEXT,
    "majorVer" TEXT,
    "minorVer" TEXT,
    "duress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiometricEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricTransaction" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "deviceSn" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "studentId" TEXT,
    "employeeId" TEXT,
    "userType" "BiometricUserType",
    "actualPunchTime" TIMESTAMP(3) NOT NULL,
    "punchTime" TIMESTAMP(3) NOT NULL,
    "punchState" INTEGER NOT NULL DEFAULT 0,
    "punchStateDisplay" TEXT NOT NULL DEFAULT 'Check In',
    "area" TEXT,
    "areaId" INTEGER,
    "terminalSn" TEXT,
    "uploadTime" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'Device',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiometricTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BiometricDevice_sn_key" ON "BiometricDevice"("sn");

-- CreateIndex
CREATE INDEX "BiometricDevice_branchId_idx" ON "BiometricDevice"("branchId");

-- CreateIndex
CREATE INDEX "BiometricDevice_isApproved_idx" ON "BiometricDevice"("isApproved");

-- CreateIndex
CREATE INDEX "BiometricDeviceCommand_sn_idx" ON "BiometricDeviceCommand"("sn");

-- CreateIndex
CREATE INDEX "BiometricDeviceCommand_branchId_idx" ON "BiometricDeviceCommand"("branchId");

-- CreateIndex
CREATE INDEX "BiometricDeviceCommand_status_idx" ON "BiometricDeviceCommand"("status");

-- CreateIndex
CREATE INDEX "BiometricDeviceCommand_sn_status_idx" ON "BiometricDeviceCommand"("sn", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricDeviceCommand_seq_key" ON "BiometricDeviceCommand"("seq");

-- CreateIndex
CREATE INDEX "BiometricDeviceLog_sn_idx" ON "BiometricDeviceLog"("sn");

-- CreateIndex
CREATE INDEX "BiometricDeviceLog_sn_createdAt_idx" ON "BiometricDeviceLog"("sn", "createdAt");

-- CreateIndex
CREATE INDEX "BiometricEnrollment_branchId_idx" ON "BiometricEnrollment"("branchId");

-- CreateIndex
CREATE INDEX "BiometricEnrollment_branchId_userCode_type_idx" ON "BiometricEnrollment"("branchId", "userCode", "type");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricEnrollment_branchId_userCode_type_index_key" ON "BiometricEnrollment"("branchId", "userCode", "type", "index");

-- CreateIndex
CREATE INDEX "BiometricTransaction_branchId_idx" ON "BiometricTransaction"("branchId");

-- CreateIndex
CREATE INDEX "BiometricTransaction_deviceSn_idx" ON "BiometricTransaction"("deviceSn");

-- CreateIndex
CREATE INDEX "BiometricTransaction_branchId_punchTime_idx" ON "BiometricTransaction"("branchId", "punchTime");

-- CreateIndex
CREATE INDEX "BiometricTransaction_studentId_punchTime_idx" ON "BiometricTransaction"("studentId", "punchTime");

-- CreateIndex
CREATE INDEX "BiometricTransaction_employeeId_punchTime_idx" ON "BiometricTransaction"("employeeId", "punchTime");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricTransaction_deviceSn_actualPunchTime_userCode_key" ON "BiometricTransaction"("deviceSn", "actualPunchTime", "userCode");

-- AddForeignKey
ALTER TABLE "BiometricDevice" ADD CONSTRAINT "BiometricDevice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricEnrollment" ADD CONSTRAINT "BiometricEnrollment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricEnrollment" ADD CONSTRAINT "BiometricEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricEnrollment" ADD CONSTRAINT "BiometricEnrollment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricTransaction" ADD CONSTRAINT "BiometricTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricTransaction" ADD CONSTRAINT "BiometricTransaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricTransaction" ADD CONSTRAINT "BiometricTransaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
