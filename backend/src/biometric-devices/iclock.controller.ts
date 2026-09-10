import { Controller, Get, Logger, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { IclockService } from './iclock.service';

/**
 * Public push-protocol endpoints called directly by ZKTeco/ESSL hardware. No
 * auth, plain-text responses. Routes are excluded from the global /api prefix
 * (see main.ts, which also wires the raw-text body parser these need). Both
 * bare and `.aspx` (ESSL) variants are registered.
 */
@Public()
@Controller()
export class IclockController {
  private readonly logger = new Logger(IclockController.name);

  constructor(private readonly iclock: IclockService) {}

  private send(res: Response, body: string) {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Date', new Date().toUTCString());
    res.send(body);
  }

  /**
   * Run a protocol handler and always reply with plain text. If the handler
   * throws, log the cause + request context and return a device-safe
   * fallback so the terminal never sees a 500 (which it would just
   * retry-storm on).
   */
  private async safe(
    res: Response,
    req: Request,
    label: string,
    fn: () => Promise<string>,
    fallback = 'OK',
  ) {
    try {
      this.send(res, await fn());
    } catch (err) {
      this.logger.error(
        `${label} failed [${req.method} ${req.originalUrl}]: ${(err as Error).message}`,
        (err as Error).stack,
      );
      this.send(res, fallback);
    }
  }

  @Get(['/iclock/cdata', '/iclock/cdata.aspx'])
  async handshake(
    @Query('SN') sn: string,
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.safe(res, req, 'handshake', () => this.iclock.handleHandshake(sn, query));
  }

  @Get(['/iclock/registry', '/iclock/registry.aspx'])
  async registry(
    @Query('SN') sn: string,
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.safe(res, req, 'registry', () => this.iclock.handleRegistry(sn, query));
  }

  @Post(['/iclock/cdata', '/iclock/cdata.aspx'])
  async receiveRecords(
    @Query('SN') sn: string,
    @Query('table') table: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const rawBody = typeof req.body === 'string' ? req.body : '';
    await this.safe(res, req, `cdata(${table ?? ''})`, () =>
      this.iclock.handleReceiveRecords(sn, table, rawBody),
    );
  }

  @Get(['/iclock/getrequest', '/iclock/getrequest.aspx'])
  async getRequest(@Query('SN') sn: string, @Req() req: Request, @Res() res: Response) {
    await this.safe(res, req, 'getrequest', () => this.iclock.handleGetRequest(sn));
  }

  @Post(['/iclock/devicecmd', '/iclock/devicecmd.aspx'])
  async deviceCommands(@Query('SN') sn: string, @Req() req: Request, @Res() res: Response) {
    const rawBody = typeof req.body === 'string' ? req.body : '';
    await this.safe(res, req, 'devicecmd', () => this.iclock.handleDeviceCommands(rawBody, sn));
  }
}
