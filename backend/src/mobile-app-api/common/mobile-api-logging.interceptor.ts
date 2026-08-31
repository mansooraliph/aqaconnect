import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

interface AuthedRequest extends Request {
  user?: { userId: string; username: string };
}

/** Records every call into a `/api/app/*` (Mobile App API) route for the admin-facing usage-history page. Never blocks or fails the request it's logging. */
@Injectable()
export class MobileApiLoggingInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthedRequest>();
    const res = http.getResponse<Response>();
    const start = Date.now();

    res.on('finish', () => {
      this.prisma.mobileApiRequestLog
        .create({
          data: {
            userId: req.user?.userId,
            username: req.user?.username,
            method: req.method,
            path: req.originalUrl ?? req.url,
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
          },
        })
        .catch(() => {
          // Logging must never break or delay the actual API response.
        });
    });

    return next.handle();
  }
}
