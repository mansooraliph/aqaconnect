-- Make surahId/fromAyah/toAyah nullable: milestone rows ("Exam", "Exam
-- preparation") generated from a SurahTargetSchedule row with no surah
-- portion carry no memorization portion either.
ALTER TABLE "SurahHifdhStudentSchedule" ALTER COLUMN "surahId" DROP NOT NULL,
ALTER COLUMN "fromAyah" DROP NOT NULL,
ALTER COLUMN "toAyah" DROP NOT NULL;
