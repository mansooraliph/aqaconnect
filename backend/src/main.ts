import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  // Body parsing is wired manually (bodyParser: false) so the /iclock/*
  // biometric-device protocol routes can read their body as raw text —
  // ZKTeco/ESSL terminals POST tab-separated plain text, not JSON.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use('/iclock', express.text({ type: () => true, limit: '5mb' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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
