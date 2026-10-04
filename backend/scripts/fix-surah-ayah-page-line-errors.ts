// One-time correction: SurahAyahPageLine had 12 rows with bad data, found by
// comparing it against a verified reference spreadsheet (page/line/juz per
// ayah). 5 rows had typo'd lineTo values (e.g. 156 instead of 15 - an extra
// digit), which also broke the lineFrom of the following ayah since
// lineFrom is expected to equal the previous ayah's lineTo. 7 rows had the
// wrong juzNumber at two juz boundaries (5:82-83 should be Juz 7 not 6;
// 45:33-37 should be Juz 25 not 26), confirmed against the standard Hafs
// Mushaf juz boundaries.
//
// Read-only by default. Pass --apply to actually write the corrections.
//
// Usage:
//   npx ts-node scripts/fix-surah-ayah-page-line-errors.ts            # dry run
//   npx ts-node scripts/fix-surah-ayah-page-line-errors.ts --apply    # writes

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Fix =
  | { surah: number; ayah: number; field: 'lineTo' | 'lineFrom'; from: number; to: number };

const FIXES: Fix[] = [
  { surah: 3, ayah: 180, field: 'lineTo', from: 16, to: 15 },
  { surah: 6, ayah: 73, field: 'lineTo', from: 156, to: 15 },
  { surah: 33, ayah: 40, field: 'lineTo', from: 15, to: 12 },
  { surah: 33, ayah: 41, field: 'lineFrom', from: 15, to: 12 },
  { surah: 34, ayah: 1, field: 'lineTo', from: 7, to: 2 },
  { surah: 34, ayah: 2, field: 'lineFrom', from: 7, to: 2 },
  { surah: 65, ayah: 5, field: 'lineTo', from: 133, to: 13 },
];

const JUZ_FIXES: { surah: number; ayahs: number[]; from: number; to: number }[] = [
  { surah: 5, ayahs: [82, 83], from: 6, to: 7 },
  { surah: 45, ayahs: [33, 34, 35, 36, 37], from: 26, to: 25 },
];

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${FIXES.length} line fixes, ${JUZ_FIXES.reduce((n, f) => n + f.ayahs.length, 0)} juz fixes`);

  for (const fix of FIXES) {
    const surah = await prisma.surah.findUnique({ where: { number: fix.surah } });
    if (!surah) {
      console.log(`  SKIP surah ${fix.surah} not found`);
      continue;
    }
    const row = await prisma.surahAyahPageLine.findUnique({
      where: { surahId_ayahNumber: { surahId: surah.id, ayahNumber: fix.ayah } },
    });
    if (!row) {
      console.log(`  SKIP ${fix.surah}:${fix.ayah} row not found`);
      continue;
    }
    const current = row[fix.field];
    if (current !== fix.from) {
      console.log(`  SKIP ${fix.surah}:${fix.ayah}.${fix.field} expected ${fix.from}, found ${current} (already changed?)`);
      continue;
    }
    console.log(`  ${fix.surah}:${fix.ayah}.${fix.field} ${fix.from} -> ${fix.to}`);
    if (apply) {
      await prisma.surahAyahPageLine.update({
        where: { id: row.id },
        data: { [fix.field]: fix.to },
      });
    }
  }

  for (const fix of JUZ_FIXES) {
    const surah = await prisma.surah.findUnique({ where: { number: fix.surah } });
    if (!surah) {
      console.log(`  SKIP surah ${fix.surah} not found`);
      continue;
    }
    for (const ayah of fix.ayahs) {
      const row = await prisma.surahAyahPageLine.findUnique({
        where: { surahId_ayahNumber: { surahId: surah.id, ayahNumber: ayah } },
      });
      if (!row) {
        console.log(`  SKIP ${fix.surah}:${ayah} row not found`);
        continue;
      }
      if (row.juzNumber !== fix.from) {
        console.log(`  SKIP ${fix.surah}:${ayah}.juzNumber expected ${fix.from}, found ${row.juzNumber} (already changed?)`);
        continue;
      }
      console.log(`  ${fix.surah}:${ayah}.juzNumber ${fix.from} -> ${fix.to}`);
      if (apply) {
        await prisma.surahAyahPageLine.update({
          where: { id: row.id },
          data: { juzNumber: fix.to },
        });
      }
    }
  }

  console.log(apply ? 'Done.' : 'Dry run complete. Re-run with --apply to write changes.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
