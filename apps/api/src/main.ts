import { Logger, ValidationPipe, HttpStatus } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { RateLimitStore } from './common/rate-limit-store';

const httpLogger = new Logger('HttpAccess');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((origin) => origin.trim());
  app.enableCors({ origin: allowedOrigins, credentials: true });

  const trustedProxyHops = process.env.TRUST_PROXY;
  app.getHttpAdapter().getInstance().set('trust proxy', trustedProxyHops && /^\d+$/.test(trustedProxyHops) ? Number(trustedProxyHops) : false);

  app.use(helmet());
  app.use((request: Request & { requestId?: string }, response: Response, next: NextFunction) => {
    const requestId = randomUUID();
    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    const startedAt = Date.now();
    response.once('finish', () => {
      const route = request.route ? `${request.baseUrl}${request.route.path}` : 'unmatched';
      httpLogger.log(JSON.stringify({ event: 'http.request.completed', requestId, method: request.method, path: route, statusCode: response.statusCode, durationMs: Date.now() - startedAt }));
    });
    next();
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    const origin = request.headers.origin;
    if (isMutation && request.headers.cookie?.includes('rary_session=') && origin && !allowedOrigins.includes(origin)) {
      response.status(403).json({ statusCode: 403, message: 'Origem não autorizada' });
      return;
    }
    next();
  });
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  const rateLogger = new Logger('RateLimit');
  const rateLimitStore = app.get(RateLimitStore);
  app.use(async (request: Request, response: Response, next: NextFunction) => {
    const path = request.path;
    const limit = path === '/api/auth/login' || path === '/api/auth/register' || path === '/api/auth/dev-login' ? Number(process.env.RATE_LIMIT_AUTH_MAX ?? 10)
      : path === '/api/meetings/join' ? Number(process.env.RATE_LIMIT_MEETING_MAX ?? 30) : Number(process.env.RATE_LIMIT_DEFAULT_MAX ?? 300);
    const key = `${request.ip}:${path}`;
    const now = Date.now();
    let count: number;
    let resetAt: number;
    if (rateLimitStore.configured) {
      try {
        const result = await rateLimitStore.consume(`rary:rate:${key}`, 60_000);
        count = result.count;
        resetAt = result.resetAt;
      } catch {
        response.status(HttpStatus.SERVICE_UNAVAILABLE).json({ statusCode: 503, message: 'Proteção temporariamente indisponível.' });
        return;
      }
    } else {
      let bucket = rateBuckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + 60_000 };
        rateBuckets.set(key, bucket);
      }
      count = ++bucket.count;
      resetAt = bucket.resetAt;
    }
    response.setHeader('RateLimit-Limit', limit);
    response.setHeader('RateLimit-Remaining', Math.max(0, limit - count));
    response.setHeader('RateLimit-Reset', Math.ceil(resetAt / 1000));
    if (count > limit) {
      rateLogger.warn(JSON.stringify({ event: 'rate_limit.exceeded', requestId: (request as Request & { requestId?: string }).requestId, method: request.method }));
      response.status(HttpStatus.TOO_MANY_REQUESTS).json({ statusCode: 429, message: 'Muitas requisições. Tente novamente em instantes.' });
      return;
    }
    if (!rateLimitStore.configured && rateBuckets.size > 10_000) {
      for (const [bucketKey, value] of rateBuckets) if (value.resetAt <= now) rateBuckets.delete(bucketKey);
    }
    next();
  });
  app.setGlobalPrefix('api');
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
