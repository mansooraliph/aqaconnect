-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('TEACHER', 'ADMIN', 'OFFICE_STAFF');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "employeeType" "EmployeeType" NOT NULL DEFAULT 'OFFICE_STAFF';
