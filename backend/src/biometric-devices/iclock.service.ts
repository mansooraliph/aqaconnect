import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { BiometricTemplateType, BiometricUserType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PrefixConfig,
  loadBiometricPrefixes,
  parseUserCode,
} from '../common/biometric/user-code.util';

interface ResolvedUser {
  studentId: string | null;
  employeeId: string | null;
  userType: BiometricUserType | null;
}

/**
 * ZKTeco / ESSL push-protocol implementation. All responses are plain text;
 * devices reject JSON. Hot paths (getrequest, cdata) avoid unnecessary work
 * and never block on logging.
 */
@Injectable()
export class IclockService {
  private readonly logger = new Logger(IclockService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** No heartbeat (getrequest/cdata) within this window → considered offline. */
  private static readonly OFFLINE_AFTER_MS = 40_000;

  /**
   * Flip devices to offline when they stop polling. Runs every 15s; a device
   * is offline if its last heartbeat (lastActivity) is older than 40s.
   * lastActivity is stored as an ISO string, which sorts chronologically, so
   * a string comparison is correct here.
   */
  @Interval('biometric-mark-offline', 15_000)
  async markStaleDevicesOffline(): Promise<void> {
    const cutoff = new Date(Date.now() - IclockService.OFFLINE_AFTER_MS).toISOString();
    await this.prisma.biometricDevice
      .updateMany({
        where: { state: '1', lastActivity: { not: null, lt: cutoff } },
        data: { state: '0' },
      })
      .catch(() => undefined);
  }

  // ── Public protocol handlers ───────────────────────────────────────────────

  /** GET /iclock/cdata — device polls for its config/options. */
  async handleHandshake(sn: string, _query: Record<string, string>): Promise<string> {
    const tz = await this.touchDevice(sn);
    const stamp = Math.floor(Date.now() / 1000);
    return [
      `GET OPTION FROM: ${sn}`,
      'Stamp=9999',
      `OpStamp=${stamp}`,
      'ErrorDelay=30',
      'Delay=10',
      'TransTimes=00:00;23:59',
      'TransInterval=2',
      'TransFlag=111111111111',
      `TimeZone=${tz}`,
      'Realtime=1',
      'Encrypt=0',
      'FaceFunOn=1',
      'FaceOnlyOn=0',
      'FaceTransOn=1',
      'FaceAlgorithm=3',
      'FaceThreshold=60',
    ].join('\n');
  }

  /** GET /iclock/registry — device first contact / handshake. */
  async handleRegistry(sn: string, _query: Record<string, string>): Promise<string> {
    const tz = await this.touchDevice(sn);
    const stamp = Math.floor(Date.now() / 1000);
    return [
      'OK',
      'Stamp=9999',
      `OpStamp=${stamp}`,
      'ErrorDelay=30',
      'Delay=10',
      'TransTimes=00:00;23:59',
      'TransInterval=2',
      'TransFlag=111111111111',
      `TimeZone=${tz}`,
      'Realtime=1',
      'Encrypt=0',
    ].join('\n');
  }

  /** GET /iclock/getrequest — device polls for pending commands. (hot path) */
  async handleGetRequest(sn: string): Promise<string> {
    // getrequest is the device's heartbeat — update "last seen" here, not
    // just on handshake/cdata, so the UI reflects live polling.
    const now = new Date().toISOString();
    this.prisma.biometricDevice
      .update({ where: { sn }, data: { pushTime: now, lastActivity: now, state: '1' } })
      .catch(() => undefined);

    // Send the short numeric `seq` as the command id (devices need a compact id).
    // `seq` is a DB-generated autoincrement, so it's always set once inserted.
    const rows = await this.prisma.biometricDeviceCommand.findMany({
      where: { sn, status: 0 },
      orderBy: { seq: 'asc' },
      take: 20,
      select: { seq: true, command: true },
    });
    if (!rows.length) return 'OK';
    return rows.map((r) => `C:${r.seq}:${r.command}`).join('\n');
  }

  /**
   * POST /iclock/devicecmd — device reports command results.
   *
   * Each line is a URL-encoded query string, e.g. `ID=<id>&Return=0&CMD=DATA`.
   * Successes are batched into one update; errors are grouped by return code.
   * Lines missing ID or Return are skipped (so we never write status=2 with a
   * null return code).
   */
  async handleDeviceCommands(rawBody: string, sn?: string): Promise<string> {
    // Persist the raw ack so the exact device format is always inspectable.
    this.logTraffic(sn ?? '', '/iclock/devicecmd', 'POST', 'devicecmd', rawBody);
    // A command ACK is also proof of life — see handleReceiveRecords.
    if (sn) {
      this.prisma.biometricDevice
        .update({ where: { sn }, data: { lastActivity: new Date().toISOString(), state: '1' } })
        .catch(() => undefined);
    }
    try {
      const successSeqs: number[] = [];
      const errorsByCode = new Map<number, number[]>();
      const ignored: string[] = [];
      let infoHandled = false;

      for (const line of rawBody.split('\n')) {
        if (line.trim() === '') continue;
        // Parse as a query string (firmware uses '&'; tolerate tab delimiters).
        const params = new URLSearchParams(line.replace(/\t/g, '&'));
        const id = params.get('ID') ?? params.get('id');
        const ret = params.get('Return') ?? params.get('return');
        const cmd = params.get('CMD') ?? params.get('cmd');

        // Refresh device info once per request, even on its own line.
        if (cmd?.toUpperCase() === 'INFO' && !infoHandled) {
          await this.updateDeviceInfo(rawBody, sn).catch(() => undefined);
          infoHandled = true;
        }

        // Skip malformed lines rather than writing a bogus status.
        if (id === null || ret === null) continue;
        // The echoed ID is our numeric `seq`; ignore anything non-numeric.
        const seq = Number(id);
        if (!Number.isInteger(seq) || seq <= 0) {
          ignored.push(id);
          continue;
        }

        if (Number(ret) === 0) {
          successSeqs.push(seq);
        } else {
          const code = Number(ret);
          const arr = errorsByCode.get(code) ?? [];
          arr.push(seq);
          errorsByCode.set(code, arr);
        }
      }

      // One query for all successes.
      let updated = 0;
      if (successSeqs.length) {
        const r = await this.prisma.biometricDeviceCommand.updateMany({
          where: { seq: { in: successSeqs } },
          data: { status: 1, deviceReturnCode: 0 },
        });
        updated += r.count;
      }
      // One query per distinct error code.
      for (const [code, seqs] of errorsByCode) {
        const r = await this.prisma.biometricDeviceCommand.updateMany({
          where: { seq: { in: seqs } },
          data: { status: 2, deviceReturnCode: code },
        });
        updated += r.count;
      }

      const errCount = [...errorsByCode.values()].reduce((a, b) => a + b.length, 0);
      this.logger.log(
        `devicecmd SN=${sn ?? '?'}: ok=${successSeqs.length} err=${errCount} ignored=${ignored.length} updated=${updated}`,
      );
      if (ignored.length) {
        this.logger.warn(
          `devicecmd: non-numeric command IDs ignored: ${ignored.slice(0, 5).join(', ')}`,
        );
      }
      return 'OK';
    } catch (err) {
      // Never 500 a device — log the cause and acknowledge so it doesn't retry-storm.
      this.logger.error(
        `devicecmd failed: ${(err as Error).message}\nBODY: ${(rawBody || '').slice(0, 2000)}`,
        (err as Error).stack,
      );
      return 'OK';
    }
  }

  /** POST /iclock/cdata — device pushes attendance / biometric data. */
  async handleReceiveRecords(sn: string, table: string, rawBody: string): Promise<string> {
    this.logTraffic(sn, '/iclock/cdata', 'POST', table, rawBody);
    // Pushing data (ATTLOG/OPERLOG/BIODATA/...) is just as much proof the
    // device is alive as getrequest — count it toward the online heartbeat too.
    this.prisma.biometricDevice
      .update({ where: { sn }, data: { lastActivity: new Date().toISOString(), state: '1' } })
      .catch(() => undefined);
    const device = await this.prisma.biometricDevice.findUnique({ where: { sn } });
    if (!device) return 'ERROR';

    const rows = rawBody
      .split('\n')
      .map((l) => l.replace(/\r$/, ''))
      .filter((l) => l.length > 0)
      .map((l) => l.split('\t'));

    try {
      const t = (table || '').toUpperCase();
      let count = rows.length;
      if (t === 'ATTLOG') {
        count = await this.processAttendanceLogs(rows, sn, device.branchId);
      } else if (t === 'OPERLOG') {
        await this.processOperLog(rawBody, sn, device.branchId);
      } else if (t === 'BIODATA') {
        await this.processBioData(rawBody, sn, device.branchId);
      } else if (t === 'BIOPHOTO') {
        await this.processBioPhoto(rawBody, sn, device.branchId);
      } else if (t === 'OPTIONS' || table === 'options') {
        await this.updateDeviceInfo(rawBody, sn);
      }
      return `OK: ${count}`;
    } catch (err) {
      this.logger.error(`receiveRecords ${table} failed: ${(err as Error).message}`);
      return `ERROR: ${rows.length}`;
    }
  }

  // ── Processors ──────────────────────────────────────────────────────────────

  private async processAttendanceLogs(
    rows: string[][],
    sn: string,
    branchId: string | null,
  ): Promise<number> {
    if (!branchId) {
      this.logger.warn(`ATTLOG from unassigned device ${sn} — skipped`);
      return 0;
    }
    const prefixes = await loadBiometricPrefixes(this.prisma, branchId);
    const userCodes = [...new Set(rows.map((r) => r[0]).filter(Boolean))];
    const resolved = await this.resolveUsers(branchId, userCodes, prefixes);

    const values = rows
      .filter((r) => r[0] && r[1])
      .map((r) => {
        const userCode = r[0];
        const actual = this.parseDeviceTime(r[1]);
        const punchState = Number(r[2] ?? 0) || 0;
        const ru = resolved.get(userCode) ?? {
          studentId: null,
          employeeId: null,
          userType: null,
        };
        return {
          branchId,
          deviceSn: sn,
          userCode,
          studentId: ru.studentId,
          employeeId: ru.employeeId,
          userType: ru.userType,
          actualPunchTime: actual,
          punchTime: actual,
          punchState,
          punchStateDisplay: punchState === 1 ? 'Check Out' : 'Check In',
          terminalSn: sn,
          uploadTime: new Date(),
          source: 'Device',
        };
      });
    if (!values.length) return 0;

    // Bulk insert; the unique index drops duplicate punches.
    const res = await this.prisma.biometricTransaction.createMany({
      data: values,
      skipDuplicates: true,
    });
    return res.count || values.length;
  }

  private async processBioData(rawBody: string, sn: string, branchId: string | null): Promise<void> {
    if (!branchId) return;

    // Lines come in two shapes: dedicated "BIODATA Pin=1\tNo=0\tIndex=0\t...Tmp=..."
    // pushes, and the more common "FP PIN=1 FID=5 Size=.. Valid=1 TMP=.." lines
    // ZK/ESSL firmware embeds directly in OPERLOG. The latter has only a SINGLE
    // space between the leading type keyword and "PIN=" — parseKv only splits on
    // tab/2+-space runs, so without stripping that keyword first, "FP PIN" gets
    // swallowed into one bogus key and the whole record silently drops.
    const records = rawBody
      .split('\n')
      .map((l) => l.replace(/\r$/, '').trim())
      .filter((l) => /pin=/i.test(l));

    const prefixes = await loadBiometricPrefixes(this.prisma, branchId);
    for (const line of records) {
      const kindMatch = /^(BIODATA|FP|FACE|PALM)\s+/i.exec(line);
      const kindHint = kindMatch?.[1]?.toUpperCase();
      const kv = this.parseKv(kindMatch ? line.slice(kindMatch[0].length) : line);
      const userCode = kv['Pin'] || kv['PIN'];
      if (!userCode) continue;
      // Dedicated BIODATA pushes carry an explicit Type code; FP/FACE/PALM
      // lines imply their type from the keyword itself instead.
      const typeCode =
        kindHint && kindHint !== 'BIODATA' ? kindHint : this.bioTypeLabel(kv['Type'] ?? kv['type']);
      const index = kv['FID'] ?? kv['Index'] ?? kv['No'] ?? '0';
      const ru = (await this.resolveUsers(branchId, [userCode], prefixes)).get(userCode);
      const type = this.asTemplateType(typeCode);
      if (!type) continue;
      await this.upsertEnrollment(branchId, sn, {
        userCode,
        type,
        index,
        no: kv['No'] ?? null,
        valid: kv['Valid'] ?? null,
        duress: kv['Duress'] ?? null,
        typeRaw: kv['Type'] ?? null,
        majorVer: kv['MajorVer'] ?? null,
        minorVer: kv['MinorVer'] ?? null,
        format: kv['Format'] ?? null,
        tmp: kv['Tmp'] ?? null,
        studentId: ru?.studentId ?? null,
        employeeId: ru?.employeeId ?? null,
        userType: ru?.userType ?? null,
      });
    }

    // Propagate templates to the branch's OTHER devices.
    await this.queueDeviceCommand(branchId, this.firstLine(rawBody), sn).catch(() => undefined);
  }

  private async processBioPhoto(rawBody: string, sn: string, branchId: string | null): Promise<void> {
    if (!branchId) return;

    const records = rawBody
      .split('\n')
      .map((l) => l.replace(/\r$/, '').trim())
      .filter((l) => /pin=/i.test(l));

    const prefixes = await loadBiometricPrefixes(this.prisma, branchId);
    for (const line of records) {
      const kv = this.parseKv(line.replace(/^(BIOPHOTO|USERPIC)\s+/i, ''));
      const userCode = kv['Pin'] || kv['PIN'];
      if (!userCode) continue;
      const isUserPic = /^USERPIC/i.test(line);
      const ru = (await this.resolveUsers(branchId, [userCode], prefixes)).get(userCode);
      await this.upsertEnrollment(branchId, sn, {
        userCode,
        type: isUserPic ? BiometricTemplateType.USERPIC : BiometricTemplateType.BIOPHOTO,
        index: '0',
        size: kv['Size'] ?? null,
        format: kv['Format'] ?? null,
        image: kv['Content'] ?? kv['FileName'] ?? null,
        studentId: ru?.studentId ?? null,
        employeeId: ru?.employeeId ?? null,
        userType: ru?.userType ?? null,
      });
    }

    await this.queueDeviceCommand(branchId, this.firstLine(rawBody), sn).catch(() => undefined);
  }

  private async processOperLog(rawBody: string, sn: string, branchId: string | null): Promise<void> {
    // OPERLOG carries mixed records; we capture biometric enrollment lines
    // and ignore pure audit/operation entries.
    const lines = rawBody
      .split('\n')
      .map((l) => l.replace(/\r$/, '').trim())
      .filter(Boolean);
    for (const line of lines) {
      if (/^FP\s/i.test(line) || /\bFID=/i.test(line)) {
        await this.processBioData(line, sn, branchId).catch(() => undefined);
      } else if (/^USERPIC\s/i.test(line) || /^BIOPHOTO\s/i.test(line)) {
        await this.processBioPhoto(line, sn, branchId).catch(() => undefined);
      }
      // USER lines: no destructive action — device remains source of truth.
    }
  }

  /** Parse a device INFO blob and refresh the stored device stats. */
  async updateDeviceInfo(rawBody: string, sn?: string): Promise<void> {
    const grab = (re: RegExp) => {
      const m = re.exec(rawBody);
      return m ? m[1].trim() : undefined;
    };
    const serial = sn ?? grab(/SerialNumber=([^\s,~]+)/i);
    if (!serial) return;
    const patch: Record<string, unknown> = {
      lastActivity: new Date().toISOString(),
      state: '1',
    };
    const ip = grab(/IPAddress=([^\s,~\n]+)/i);
    const userCount = grab(/UserCount=(\d+)/i);
    const txCount = grab(/(?:TransactionCount|AttCount)=(\d+)/i);
    const fpCount = grab(/FPCount=(\d+)/i);
    const faceCount = grab(/FaceCount=(\d+)/i);
    const fwVer = grab(/FWVersion=([^\s,~\n]+)/i);
    if (ip) patch.ipAddress = ip;
    if (userCount) patch.userCount = Number(userCount);
    if (txCount) patch.transactionCount = Number(txCount);
    if (fpCount) patch.fpCount = Number(fpCount);
    if (faceCount) patch.faceCount = Number(faceCount);
    if (fwVer) patch.fwVer = fwVer;
    patch.lastSyncAt = new Date();
    await this.prisma.biometricDevice
      .update({ where: { sn: serial }, data: patch })
      .catch(() => undefined);
  }

  /**
   * Queue a command to a branch's approved devices (optionally exclude one SN
   * or target only one). Single bulk insert.
   */
  async queueDeviceCommand(
    branchId: string,
    command: string,
    exceptSn?: string,
    onlySn?: string,
    createdByUserId?: string,
  ): Promise<void> {
    if (!command) return;
    const devices = await this.prisma.biometricDevice.findMany({
      where: { branchId, isApproved: true },
      select: { sn: true },
    });
    const targets = devices
      .map((d) => d.sn)
      .filter((s) => (onlySn ? s === onlySn : exceptSn ? s !== exceptSn : true));
    if (!targets.length) return;
    await this.prisma.biometricDeviceCommand.createMany({
      data: targets.map((sn) => ({
        sn,
        branchId,
        command,
        status: 0,
        createdByUserId: createdByUserId ?? null,
      })),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Find-or-create the device; mark online; return its tz offset (minutes). */
  private async touchDevice(sn: string): Promise<number> {
    if (!sn) return 0;
    const device = await this.prisma.biometricDevice.findUnique({ where: { sn } });
    if (!device) {
      const created = await this.prisma.biometricDevice.create({
        data: {
          sn,
          alias: sn,
          deviceType: 'iclock',
          isApproved: false,
          branchId: null,
          state: '1',
          lastActivity: new Date().toISOString(),
        },
      });
      this.logger.log(`Auto-registered new biometric device: ${sn}`);
      return created.terminalTz ?? 0;
    }
    await this.prisma.biometricDevice.update({
      where: { sn },
      data: { state: '1', lastActivity: new Date().toISOString() },
    });
    return device.terminalTz ?? 0;
  }

  /**
   * Resolve device PINs to a student / employee. PINs carry a one-letter type
   * prefix (see user-code.util). Codes without a recognised prefix fall back
   * to a raw studentCode/employeeCode match for backward compatibility.
   */
  private async resolveUsers(
    branchId: string,
    userCodes: string[],
    prefixes: PrefixConfig,
  ): Promise<Map<string, ResolvedUser>> {
    const map = new Map<string, ResolvedUser>();
    if (!userCodes.length) return map;

    const studentBases = new Map<string, string>(); // base -> raw code
    const employeeBases = new Map<string, string[]>(); // base -> raw codes (T or E)
    const legacy: string[] = [];

    for (const raw of userCodes) {
      const parsed = parseUserCode(raw, prefixes);
      if (!parsed) {
        legacy.push(raw);
        continue;
      }
      if (parsed.type === BiometricUserType.STUDENT) {
        studentBases.set(parsed.base, raw);
      } else {
        const arr = employeeBases.get(parsed.base) ?? [];
        arr.push(raw);
        employeeBases.set(parsed.base, arr);
      }
    }
    // Legacy codes: try both a student and an employee raw match.
    for (const raw of legacy) {
      studentBases.set(raw, raw);
      const arr = employeeBases.get(raw) ?? [];
      arr.push(raw);
      employeeBases.set(raw, arr);
    }

    if (studentBases.size) {
      const bases = [...studentBases.keys()];
      const students = await this.prisma.student.findMany({
        where: { branchId, studentCode: { in: bases } },
        select: { id: true, studentCode: true },
      });
      for (const s of students) {
        const raw = studentBases.get(s.studentCode);
        if (raw) {
          map.set(raw, { studentId: s.id, employeeId: null, userType: BiometricUserType.STUDENT });
        }
      }
    }

    if (employeeBases.size) {
      const employees = await this.prisma.employee.findMany({
        where: { branchId, employeeCode: { in: [...employeeBases.keys()] } },
        select: { id: true, employeeCode: true, employeeType: true },
      });
      for (const e of employees) {
        for (const raw of employeeBases.get(e.employeeCode) ?? []) {
          if (map.has(raw)) continue; // a student match already won this code
          map.set(raw, {
            studentId: null,
            employeeId: e.id,
            userType: e.employeeType === 'TEACHER' ? BiometricUserType.TEACHER : BiometricUserType.STAFF,
          });
        }
      }
    }

    return map;
  }

  private async upsertEnrollment(
    branchId: string,
    deviceSn: string,
    data: {
      userCode: string;
      type: BiometricTemplateType;
      index: string;
      studentId?: string | null;
      employeeId?: string | null;
      userType?: BiometricUserType | null;
      [key: string]: unknown;
    },
  ): Promise<void> {
    const index = data.index ?? '0';
    const { userCode, type, ...rest } = data;
    // Reaching here means the device pushed back an actual template/photo —
    // proof the capture succeeded — so flip 'pending' → 'enrolled'.
    const payload = { ...rest, index, deviceSn, status: 'ENROLLED' as const };
    await this.prisma.biometricEnrollment.upsert({
      where: { branchId_userCode_type_index: { branchId, userCode, type, index } },
      create: { branchId, userCode, type, ...payload },
      update: payload,
    });
  }

  private parseKv(line: string): Record<string, string> {
    const out: Record<string, string> = {};
    // Records are tab-separated key=value pairs; tolerate spaces too.
    for (const part of line.split(/\t|\s{2,}/)) {
      const eq = part.indexOf('=');
      if (eq > 0) out[part.slice(0, eq).trim()] = part.slice(eq + 1);
    }
    return out;
  }

  private bioTypeLabel(raw?: string): string {
    switch ((raw ?? '').trim()) {
      case '0':
        return 'FP';
      case '2':
        return 'FACE';
      case '9':
        return 'PALM';
      default:
        return (raw || 'FP').toUpperCase();
    }
  }

  private asTemplateType(raw: string): BiometricTemplateType | null {
    return raw in BiometricTemplateType ? (raw as BiometricTemplateType) : null;
  }

  private parseDeviceTime(s: string): Date {
    const t = (s || '').trim();
    const d = new Date(t.replace(' ', 'T'));
    return isNaN(d.getTime()) ? new Date() : d;
  }

  private firstLine(raw: string): string {
    return raw.split('\n')[0]?.replace(/\r$/, '') ?? '';
  }

  /** Fire-and-forget request log (never blocks the device response). */
  private logTraffic(sn: string, url: string, method: string, tableName: string | null, data: string): void {
    setImmediate(() => {
      this.prisma.biometricDeviceLog
        .create({
          data: {
            sn: sn || null,
            url,
            method,
            tableName: tableName || null,
            data: (data || '').slice(0, 10_000),
          },
        })
        .catch(() => undefined);
    });
  }
}
