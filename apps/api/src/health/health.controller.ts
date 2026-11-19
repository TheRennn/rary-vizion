import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('health')
export class HealthController {
  constructor(private readonly supabase: SupabaseService) {}

  @Public()
  @Get()
  async check() {
    await this.supabase.healthCheck();
    return { status: 'ok', time: new Date().toISOString() };
  }
}
