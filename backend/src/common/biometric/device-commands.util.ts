export type BiometricType = 'fingerprint' | 'face' | 'palm';

export const BIO_TYPE_LABEL: Record<BiometricType, 'FP' | 'FACE' | 'PALM'> = {
  fingerprint: 'FP',
  face: 'FACE',
  palm: 'PALM',
};

/**
 * Build the device add/update-user command. Card/Passwd/Grp must be present
 * (even if empty) or some firmware silently drops the record.
 */
export function buildAddUserCommand(userCode: string, name: string): string {
  return `DATA UPDATE USERINFO PIN=${userCode}\tName=${name}\tPri=0\tPasswd=\tCard=\tGrp=1`;
}

export function buildEnrollCommand(
  userCode: string,
  biometricType: BiometricType,
  fingerId?: number,
): string {
  switch (biometricType) {
    case 'face':
      return `ENROLL_FACE\tPIN=${userCode}\tRETRY=3\tOVERWRITE=1`;
    case 'palm':
      return `ENROLL_PALM\tPIN=${userCode}\tRETRY=3\tOVERWRITE=1`;
    case 'fingerprint':
    default:
      return `ENROLL_FP\tPIN=${userCode}\tFID=${fingerId ?? 6}\tRETRY=3\tOVERWRITE=1`;
  }
}

export const REBOOT_COMMAND = 'REBOOT';
export const INFO_COMMAND = 'INFO';
export const CLEAR_LOG_COMMAND = 'CLEAR LOG';

export function buildSetDuplicatePunchCommand(seconds: number): string {
  return `SET OPTION AlarmReRec=${seconds}`;
}
