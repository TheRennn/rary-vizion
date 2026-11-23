import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../common/decorators';
import { RateLimitStore } from '../common/rate-limit-store';
import { SupabaseDataService } from '../supabase/supabase.service';

@Controller('health')
export class HealthController {
  constructor(private readonly supabase: SupabaseDataService, private readonly rateLimitStore: RateLimitStore) {}

  @Public()
  @Get()
  async check() {
    let supabase: 'ok' | 'unavailable' = 'ok';
    let redis: 'ok' | 'not-configured' | 'unavailable' = 'not-configured';
    try {
      await this.supabase.healthCheck();
    } catch {
      supabase = 'unavailable';
    }
    try { redis = await this.rateLimitStore.health(); } catch { redis = 'unavailable'; }
    const status = supabase === 'ok' && redis !== 'unavailable' ? 'ok' : 'unavailable';
    if (status !== 'ok') throw new ServiceUnavailableException({ status, time: new Date().toISOString(), services: { supabase, redis } });
    return { status, time: new Date().toISOString(), services: { supabase, redis }, target: this.supabase.local ? 'local' : this.supabase.development ? 'development' : 'hosted' };
  }
}
