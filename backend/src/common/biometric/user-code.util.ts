import { BiometricUserType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Device user-code (PIN) scheme. Every enrolled user gets a type prefix so the
 * same base id can't collide across user types and a punch's PIN is decodable
 * back to its user type. Prefixes are configurable per branch
 * (BranchSettings.biometricPrefixes); these are the defaults:
 *
 *   Student → `S` + studentCode
 *   Teacher → `T` + employeeCode   (Employee.employeeType === TEACHER)
 *   Staff   → `E` + employeeCode   (non-teaching employee)
 *
 * A prefix is nullable — a branch can clear it for a given user type so that
 * type's device PIN is just the raw base id with no prefix. A cleared prefix
 * can't be used to decode a punch back to its type, so those codes fall back
 * to a raw match (see IclockService.resolveUsers).
 */
export type PrefixConfig = Record<BiometricUserType, string | null>;

export const BIOMETRIC_USER_TYPES: BiometricUserType[] = [
  BiometricUserType.STUDENT,
  BiometricUserType.TEACHER,
  BiometricUserType.STAFF,
];

export const DEFAULT_PREFIXES: PrefixConfig = {
  STUDENT: 'S',
  TEACHER: 'T',
  STAFF: 'E',
};

/** Build the device PIN for a user from its type + base identifier. */
export function buildUserCode(
  type: BiometricUserType,
  base: string,
  prefixes: PrefixConfig = DEFAULT_PREFIXES,
): string {
  return `${prefixes[type] ?? ''}${base}`;
}

export interface ParsedUserCode {
  type: BiometricUserType;
  base: string;
}

/** Decode a prefixed device PIN (longest matching prefix wins), or null. */
export function parseUserCode(
  code: string,
  prefixes: PrefixConfig = DEFAULT_PREFIXES,
): ParsedUserCode | null {
  if (!code) return null;
  let best: { type: BiometricUserType; prefix: string } | null = null;
  for (const type of BIOMETRIC_USER_TYPES) {
    const p = prefixes[type];
    if (p && code.startsWith(p) && (!best || p.length > best.prefix.length)) {
      best = { type, prefix: p };
    }
  }
  if (!best) return null;
  return { type: best.type, base: code.slice(best.prefix.length) };
}

/**
 * Normalize a (partial) prefix config, filling gaps with the defaults. A key
 * that's absent from `input` keeps its default; a key explicitly set to
 * `null`/`''` is persisted as `null` (no prefix for that type).
 */
export function sanitizePrefixes(input: unknown): PrefixConfig {
  const raw = (input ?? {}) as Partial<Record<BiometricUserType, string | null>>;
  const out: PrefixConfig = { ...DEFAULT_PREFIXES };
  for (const t of BIOMETRIC_USER_TYPES) {
    if (!(t in raw)) continue;
    const v = raw[t];
    const trimmed = typeof v === 'string' ? v.trim() : '';
    out[t] = trimmed || null;
  }
  return out;
}

/**
 * Validate a prefix config for use. Returns an error message, or null if
 * valid. A prefix may be null (no prefix for that user type); when set, it
 * must be 1-8 alphanumerics, and no prefix may be a leading substring of
 * another (which would make PIN parsing ambiguous).
 */
export function validatePrefixes(prefixes: PrefixConfig): string | null {
  for (const t of BIOMETRIC_USER_TYPES) {
    const p = prefixes[t];
    if (p == null) continue;
    if (!/^[A-Za-z0-9]{1,8}$/.test(p)) {
      return `Prefix "${p}" (${t}) must be 1-8 letters or digits`;
    }
  }
  for (const a of BIOMETRIC_USER_TYPES) {
    for (const b of BIOMETRIC_USER_TYPES) {
      const pa = prefixes[a];
      const pb = prefixes[b];
      if (a !== b && pa && pb && pb.startsWith(pa)) {
        return `Prefix "${pa}" (${a}) conflicts with "${pb}" (${b}) — one can't start the other`;
      }
    }
  }
  return null;
}

/** Read the prefix config out of a BranchSettings.biometricPrefixes blob. */
export function prefixesFromSettings(settings?: unknown): PrefixConfig {
  return sanitizePrefixes(settings);
}

/** Load a branch's configured prefixes from BranchSettings. */
export async function loadBiometricPrefixes(
  prisma: PrismaService,
  branchId: string,
): Promise<PrefixConfig> {
  const settings = await prisma.branchSettings.findUnique({
    where: { branchId },
    select: { biometricPrefixes: true },
  });
  return prefixesFromSettings(settings?.biometricPrefixes);
}
