import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

export interface RateLimitWindow {
  count: number;
  resetAt: number;
}

const INCREMENT_WITH_TTL = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('PTTL',KEYS[1])}";

@Injectable()
export class RateLimitStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitStore.name);
  private readonly url?: string;
  private readonly token?: string;
  private client?: RedisClientType;

  constructor(config: ConfigService) {
    this.url = config.get<string>('RATE_LIMIT_REDIS_URL');
    this.token = config.get<string>('RATE_LIMIT_REDIS_TOKEN');
  }

  get configured(): boolean {
    return Boolean(this.url);
  }

  async onModuleInit(): Promise<void> {
    if (!this.url) return;
    const protocol = new URL(this.url).protocol;
    if (protocol === 'redis:' || protocol === 'rediss:') {
      this.client = createClient({
        url: this.url,
        socket: {
          connectTimeout: 3_000,
          reconnectStrategy: (retries) => retries > 3 ? false : Math.min(100 * (2 ** retries), 1_000),
        },
      });
      this.client.on('error', () => this.logger.error('Redis client connection error'));
      await this.client.connect();
    }
  }

  async consume(key: string, windowMs: number): Promise<RateLimitWindow> {
    if (!this.url) throw new Error('Rate limit store is not configured');
    const now = Date.now();
    const protocol = new URL(this.url).protocol;
    if (protocol === 'redis:' || protocol === 'rediss:') {
      if (!this.client?.isReady) throw new Error('Redis client is not ready');
      const result = await this.client.eval(INCREMENT_WITH_TTL, { keys: [key], arguments: [String(windowMs)] }) as number[];
      if (!Array.isArray(result) || result.length !== 2) throw new Error('Unexpected Redis response');
      return { count: Number(result[0]), resetAt: now + Number(result[1]) };
    }

    if (!this.token) throw new Error('Redis REST token is not configured');
    const response = await fetch(this.url, {
      method: 'POST',
      signal: AbortSignal.timeout(3_000),
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['EVAL', INCREMENT_WITH_TTL, '1', key, String(windowMs)]),
    });
    if (!response.ok) throw new Error('Redis REST request failed');
    const payload = await response.json() as { result?: [number, number]; error?: string };
    if (payload.error || !payload.result) throw new Error('Unexpected Redis REST response');
    return { count: Number(payload.result[0]), resetAt: now + Number(payload.result[1]) };
  }

  async health(): Promise<'ok' | 'not-configured'> {
    if (!this.url) return 'not-configured';
    const protocol = new URL(this.url).protocol;
    if (protocol === 'redis:' || protocol === 'rediss:') {
      if (!this.client?.isReady) throw new Error('Redis client is not ready');
      if (await this.client.ping() !== 'PONG') throw new Error('Unexpected Redis response');
      return 'ok';
    }
    if (!this.token) throw new Error('Redis REST token is not configured');
    const response = await fetch(this.url, {
      method: 'POST', signal: AbortSignal.timeout(3_000),
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['PING']),
    });
    if (!response.ok) throw new Error('Redis REST health request failed');
    const payload = await response.json() as { result?: string; error?: string };
    if (payload.error || payload.result !== 'PONG') throw new Error('Unexpected Redis REST response');
    return 'ok';
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) await this.client.close();
  }
}
