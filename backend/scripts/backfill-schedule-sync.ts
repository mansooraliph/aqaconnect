// One-time backfill: SurahHifdhStudentSchedule.status is supposed to track
// StudentSurahProgressEntry completions via syncScheduleEntries() (see
// student-surah-progress.service.ts), but that only runs as a side effect of
// bulkMarkCompleted/bulkMarkSurahsAsCompleted. Progress entries written any
// other way (e.g. a bulk data import) never triggered it, leaving schedule
// rows stuck at PENDING despite their ayahs being fully completed. This
// script applies the identical "fully covered" matching logic across every
// non-completed schedule row, once, so existing history catches up.
//
// Read-only by default. Pass --apply to actually write the status updates.
//
// Usage:
//   npx ts-node scripts/backfill-schedule-sync.ts            # dry run
//   npx ts-node scripts/backfill-schedule-sync.ts --apply    # writes

import { PrismaClient, HifdhScheduleStatus, ProgressEntryType, ProgressEntryStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');

  const pendingSchedules = await prisma.surahHifdhStudentSchedule.findMany({
    where: {
      status: { not: HifdhScheduleStatus.COMPLETED },
      surahId: { not: null },
      fromAyah: { not: null },
      toAyah: { not: null },
    },
    select: { id: true, studentId: true, surahId: true, fromAyah: true, toAyah: true },
  });

  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${pendingSchedules.length} non-completed schedule rows to check`);

  let checked = 0;
  let wouldUpdate = 0;

  for (const schedule of pendingSchedules) {
    checked++;
    if (!schedule.surahId || schedule.fromAyah === null || schedule.toAyah === null) continue;

    const coveringEntries = await prisma.studentSurahProgressEntry.findMany({
      where: {
        studentId: schedule.studentId,
        surahId: schedule.surahId,
        type: ProgressEntryType.NEW_LESSON,
        fromAyah: { gte: schedule.fromAyah, lte: schedule.toAyah },
      },
      select: { status: true, completedAt: true },
    });

    const fullyCovered =
      coveringEntries.length > 0 &&
      coveringEntries.every(
        (e) => e.status === ProgressEntryStatus.COMPLETED || e.status === ProgressEntryStatus.VERIFIED,
      );

    if (fullyCovered) {
      wouldUpdate++;
      const completedAt =
        coveringEntries.reduce<Date | null>((latest, e) => {
          if (!e.completedAt) return latest;
          return !latest || e.completedAt > latest ? e.completedAt : latest;
        }, null) ?? new Date();

      if (apply) {
        await prisma.surahHifdhStudentSchedule.update({
          where: { id: schedule.id },
          data: {
            status: HifdhScheduleStatus.COMPLETED,
            completedAt,
            completionDate: completedAt,
          },
        });
      }
    }

    if (checked % 1000 === 0) {
      console.log(`  checked ${checked}/${pendingSchedules.length}, matched so far: ${wouldUpdate}`);
    }
  }

  console.log(
    `Done. Checked ${checked} rows, ${apply ? 'updated' : 'would update'} ${wouldUpdate}.`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
