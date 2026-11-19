import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use((request: Request & { requestId?: string }, response: Response, next: NextFunction) => {
    const requestId = randomUUID();
    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    next();
  });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((origin) => origin.trim()),
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);
  new Logger('Bootstrap').log(`API em http://localhost:${port}/api`);
}

void bootstrap();
