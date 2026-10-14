-- CreateTable
CREATE TABLE "TeacherGradingThresholds" (
    "id" TEXT NOT NULL,
    "excellentMin" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "goodMin" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "averageMin" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherGradingThresholds_pkey" PRIMARY KEY ("id")
);
