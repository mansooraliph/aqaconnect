import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { UPLOADS_DIR } from './mobile-app-api/profile/upload-paths';

async function bootstrap() {
  // Body parsing is wired manually (bodyParser: false) so the /iclock/*
  // biometric-device protocol routes can read their body as raw text —
  // ZKTeco/ESSL terminals POST tab-separated plain text, not JSON.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Behind nginx, which terminates TLS and forwards plain HTTP internally
  // (proxy_pass http://127.0.0.1:<port>) — without this, req.protocol always
  // reads 'http' even for real https:// requests, since nginx does set
  // X-Forwarded-Proto but Express ignores it unless proxies are trusted.
  // Port 3017 (etc.) is only bound to localhost, reachable solely via nginx,
  // so trusting the immediate hop here is safe.
  app.getHttpAdapter().getInstance().set('trust proxy', true);
  app.use('/iclock', express.text({ type: () => true, limit: '5mb' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // Serves uploaded profile avatars back out at /uploads/avatars/<file> —
  // plain local-disk storage (see ProfileService.editProfile), fine for a
  // single-instance deployment; move to shared/object storage (S3-compatible)
  // if this backend is ever scaled to multiple instances behind a load balancer.
  app.use('/uploads', express.static(join(UPLOADS_DIR, '..')));

  // Public legal/account-deletion pages and the /iclock/* device protocol
  // live at clean top-level URLs, not under /api.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'privacy-policy', method: RequestMethod.GET },
      { path: 'terms-conditions', method: RequestMethod.GET },
      { path: 'delete-account', method: RequestMethod.GET },
      { path: 'account/delete-request', method: RequestMethod.POST },
      { path: 'iclock/cdata', method: RequestMethod.GET },
      { path: 'iclock/cdata.aspx', method: RequestMethod.GET },
      { path: 'iclock/cdata', method: RequestMethod.POST },
      { path: 'iclock/cdata.aspx', method: RequestMethod.POST },
      { path: 'iclock/registry', method: RequestMethod.GET },
      { path: 'iclock/registry.aspx', method: RequestMethod.GET },
      { path: 'iclock/getrequest', method: RequestMethod.GET },
      { path: 'iclock/getrequest.aspx', method: RequestMethod.GET },
      { path: 'iclock/devicecmd', method: RequestMethod.POST },
      { path: 'iclock/devicecmd.aspx', method: RequestMethod.POST },
    ],
  });
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
