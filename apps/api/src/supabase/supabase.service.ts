import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleDestroy {
  readonly publicClient: SupabaseClient;
  readonly adminClient: SupabaseClient;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL');
    const publishableKey = config.getOrThrow<string>('SUPABASE_PUBLISHABLE_KEY');
    const secretKey = config.getOrThrow<string>('SUPABASE_SECRET_KEY');

    this.publicClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.adminClient = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async healthCheck(): Promise<void> {
    const { error } = await this.adminClient.from('companies').select('id').limit(1);
    if (error) throw new Error(`Supabase indisponível: ${error.message}`);
  }

  onModuleDestroy(): void {}
}
