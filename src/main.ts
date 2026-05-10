import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger('Bootstrap');

  app.use('/api/v1/messages/webhook/whatsapp', urlencoded({ extended: false }));
  app.use(cookieParser());

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'https://res.cloudinary.com', 'data:'],
          connectSrc: ["'self'", `wss://${process.env.API_DOMAIN ?? 'localhost:3001'}`],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed =
        /^https:\/\/([a-z0-9-]+\.)?propertysales\.com$/.test(origin) || origin === 'http://localhost:3000';
      cb(allowed ? null : new Error('CORS'), allowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'x-lang', 'x-correlation-id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor(), new LoggingInterceptor());

  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PropertySales OS API')
    .setVersion('1.0')
    .addCookieAuth('jwt')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig), {
    useGlobalPrefix: false,
  });

  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = await import('@sentry/nestjs');
      Sentry.init({ dsn: process.env.SENTRY_DSN });
    } catch {
      logger.warn('Sentry init skipped');
    }
  }

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  logger.log(`Listening on http://localhost:${port}`);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
