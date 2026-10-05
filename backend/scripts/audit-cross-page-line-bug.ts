// Read-only audit: how many students/blocks were affected by the
// cross-page true-line-count bug fixed in computeTrueLines (see
// student-surah-progress.service.ts). The bug only mis-measured a merged
// ayah block when that block's ayahs span two different Mushaf pages — this
// scans every student's progress entries, merges them the same way the
// real calculation does, and reports every block where the old (buggy)
// formula and the new (fixed) formula disagree.
//
// Usage:
//   npx ts-node scripts/audit-cross-page-line-bug.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function mergeAyahRanges(ranges: [number, number][]): [number, number][] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [from, to] of sorted) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1] + 1) {
      last[1] = Math.max(last[1], to);
    } else {
      merged.push([from, to]);
    }
  }
  return merged;
}

async function main() {
  const entries = await prisma.studentSurahProgressEntry.findMany({
    where: { surahId: { not: null }, fromAyah: { not: null }, toAyah: { not: null } },
    select: { studentId: true, surahId: true, type: true, fromAyah: true, toAyah: true },
  });
  console.log(`${entries.length} progress entries with a surah+ayah range`);

  const uniqueSurahIds = [...new Set(entries.map((e) => e.surahId!))];
  const pageLines = await prisma.surahAyahPageLine.findMany({
    where: { surahId: { in: uniqueSurahIds } },
    select: { surahId: true, ayahNumber: true, quranPageId: true, lineFrom: true, lineTo: true },
  });
  const lineInfoOf = new Map<
    string,
    { quranPageId: string; lineFrom: number; lineTo: number }
  >();
  for (const pl of pageLines) {
    lineInfoOf.set(`${pl.surahId}:${pl.ayahNumber}`, {
      quranPageId: pl.quranPageId,
      lineFrom: pl.lineFrom,
      lineTo: pl.lineTo,
    });
  }

  // OLD (buggy): whole block measured end-to-end, breaks across a page.
  function oldLines(surahId: string, fromAyah: number, toAyah: number): number {
    const start = lineInfoOf.get(`${surahId}:${fromAyah}`);
    const end = lineInfoOf.get(`${surahId}:${toAyah}`);
    if (!start || !end) return toAyah - fromAyah + 1; // fallback, same as prod
    return end.lineTo - start.lineFrom + 1;
  }
  // NEW (fixed): split into same-page runs first.
  function newLines(surahId: string, fromAyah: number, toAyah: number): number {
    let lines = 0;
    let runPageId: string | null = null;
    let runStart: number | null = null;
    let runEnd: number | null = null;
    const closeRun = () => {
      if (runStart !== null && runEnd !== null) lines += runEnd - runStart + 1;
      runPageId = null;
      runStart = null;
      runEnd = null;
    };
    for (let ayah = fromAyah; ayah <= toAyah; ayah++) {
      const info = lineInfoOf.get(`${surahId}:${ayah}`);
      if (!info) {
        closeRun();
        lines += 1;
        continue;
      }
      if (runPageId !== null && info.quranPageId !== runPageId) closeRun();
      if (runPageId === null) {
        runPageId = info.quranPageId;
        runStart = info.lineFrom;
      }
      runEnd = info.lineTo;
    }
    closeRun();
    return lines;
  }

  // group by studentId|surahId|type (nested, avoids delimiter ambiguity)
  const grouped = new Map<string, Map<string, Map<string, [number, number][]>>>();
  for (const e of entries) {
    if (!e.surahId || e.fromAyah === null || e.toAyah === null) continue;
    const byType = grouped.get(e.studentId) ?? new Map<string, Map<string, [number, number][]>>();
    const bySurah = byType.get(e.type ?? '') ?? new Map<string, [number, number][]>();
    const ranges = bySurah.get(e.surahId) ?? [];
    ranges.push([e.fromAyah, e.toAyah]);
    bySurah.set(e.surahId, ranges);
    byType.set(e.type ?? '', bySurah);
    grouped.set(e.studentId, byType);
  }

  let affectedBlocks = 0;
  let totalBlocks = 0;
  const affectedStudents = new Set<string>();
  let totalUndercounted = 0; // sum of (new - old) where new > old
  const examples: { studentId: string; surahId: string; type: string; from: number; to: number; old: number; new: number }[] = [];

  for (const [studentId, byType] of grouped) {
    for (const [type, bySurah] of byType) {
      for (const [surahId, ranges] of bySurah) {
        const blocks = mergeAyahRanges(ranges);
        for (const [from, to] of blocks) {
          totalBlocks++;
          const o = oldLines(surahId, from, to);
          const n = newLines(surahId, from, to);
          if (o !== n) {
            affectedBlocks++;
            affectedStudents.add(studentId);
            totalUndercounted += n - o;
            if (examples.length < 25) {
              examples.push({ studentId, surahId, type, from, to, old: o, new: n });
            }
          }
        }
      }
    }
  }

  console.log(`\nTotal merged blocks checked: ${totalBlocks}`);
  console.log(`Blocks affected (old != new): ${affectedBlocks}`);
  console.log(`Distinct students affected: ${affectedStudents.size}`);
  console.log(`Net lines undercounted across all affected blocks (new - old summed): ${totalUndercounted}`);
  console.log(`\nExamples (up to 25):`);
  for (const ex of examples) {
    console.log(
      `  student=${ex.studentId} surah=${ex.surahId} type=${ex.type} ayah ${ex.from}-${ex.to}: old=${ex.old} new=${ex.new} (diff ${ex.new - ex.old})`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
