import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Public legal/account-deletion pages live at clean top-level URLs
  // (required for app-store submission), not under /api.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'privacy-policy', method: RequestMethod.GET },
      { path: 'terms-conditions', method: RequestMethod.GET },
      { path: 'delete-account', method: RequestMethod.GET },
      { path: 'account/delete-request', method: RequestMethod.POST },
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
