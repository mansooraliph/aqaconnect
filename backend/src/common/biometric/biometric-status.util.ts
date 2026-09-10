import { PrismaService } from '../../prisma/prisma.service';

export type BiometricStatus = 'enrolled' | 'pending' | 'none';

/**
 * Look up each id's biometric enrollment status on the given FK column
 * ('enrolled' beats 'pending' when a user has rows in both states, e.g. one
 * finger captured and a second still queued). Ids with no row are 'none'.
 */
export async function getBiometricStatusMap(
  prisma: PrismaService,
  branchId: string,
  fk: 'studentId' | 'employeeId',
  ids: string[],
): Promise<Map<string, BiometricStatus>> {
  const map = new Map<string, BiometricStatus>();
  if (!ids.length) return map;
  const rows =
    fk === 'studentId'
      ? await prisma.biometricEnrollment.findMany({
          where: { branchId, studentId: { in: ids } },
          select: { studentId: true, status: true },
        })
      : await prisma.biometricEnrollment.findMany({
          where: { branchId, employeeId: { in: ids } },
          select: { employeeId: true, status: true },
        });
  for (const r of rows) {
    const id = fk === 'studentId' ? (r as { studentId: string | null }).studentId : (r as { employeeId: string | null }).employeeId;
    if (!id) continue;
    if (r.status === 'ENROLLED') map.set(id, 'enrolled');
    else if (!map.has(id)) map.set(id, 'pending');
  }
  return map;
}
