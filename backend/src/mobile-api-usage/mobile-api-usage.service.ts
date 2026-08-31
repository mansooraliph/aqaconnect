import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListLogsQueryDto } from './dto/list-logs-query.dto';

@Injectable()
export class MobileApiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListLogsQueryDto) {
    const where: Prisma.MobileApiRequestLogWhereInput = {
      ...(query.method && { method: query.method.toUpperCase() }),
      ...(query.path && { path: { contains: query.path, mode: 'insensitive' } }),
      ...(query.username && { username: { contains: query.username, mode: 'insensitive' } }),
      ...(query.status_code && { statusCode: Number(query.status_code) }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        },
      }),
    };

    const perPage = query.per_page ? Number(query.per_page) : 25;
    const page = query.page ? Number(query.page) : 1;

    const [total, logs] = await Promise.all([
      this.prisma.mobileApiRequestLog.count({ where }),
      this.prisma.mobileApiRequestLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      data: logs,
      meta: {
        current_page: page,
        per_page: perPage,
        total,
        last_page: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  async summary() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalCalls, callsLast7Days, errorCalls, byPath, byDay] = await Promise.all([
      this.prisma.mobileApiRequestLog.count(),
      this.prisma.mobileApiRequestLog.count({ where: { createdAt: { gte: since } } }),
      this.prisma.mobileApiRequestLog.count({ where: { statusCode: { gte: 400 } } }),
      this.prisma.mobileApiRequestLog.groupBy({
        by: ['path', 'method'],
        _count: { _all: true },
        orderBy: { _count: { path: 'desc' } },
        take: 10,
      }),
      this.prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT to_char("createdAt", 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS count
        FROM "MobileApiRequestLog"
        WHERE "createdAt" >= ${since}
        GROUP BY day
        ORDER BY day ASC
      `,
    ]);

    return {
      total_calls: totalCalls,
      calls_last_7_days: callsLast7Days,
      error_calls: errorCalls,
      top_endpoints: byPath.map((r) => ({ method: r.method, path: r.path, count: r._count._all })),
      calls_by_day: byDay.map((r) => ({ day: r.day, count: Number(r.count) })),
    };
  }

  /** Per-user call aggregate, for the "Usage by User" tab. */
  async byUser() {
    const rows = await this.prisma.$queryRaw<
      { user_id: string | null; username: string | null; total_calls: bigint; error_calls: bigint; last_call_at: Date }[]
    >`
      SELECT
        "userId" AS user_id,
        "username" AS username,
        COUNT(*)::bigint AS total_calls,
        COUNT(*) FILTER (WHERE "statusCode" >= 400)::bigint AS error_calls,
        MAX("createdAt") AS last_call_at
      FROM "MobileApiRequestLog"
      GROUP BY "userId", "username"
      ORDER BY total_calls DESC
    `;

    return {
      data: rows.map((r) => ({
        user_id: r.user_id,
        username: r.username,
        total_calls: Number(r.total_calls),
        error_calls: Number(r.error_calls),
        last_call_at: r.last_call_at,
      })),
    };
  }
}
