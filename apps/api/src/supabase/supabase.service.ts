import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

@Injectable()
export class SupabaseService implements OnModuleDestroy {
  readonly publicClient: SupabaseClient;
  readonly adminClient: SupabaseClient;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL');
    const publishableKey = config.getOrThrow<string>('SUPABASE_PUBLISHABLE_KEY');
    const secretKey = config.getOrThrow<string>('SUPABASE_SECRET_KEY');
    // Supabase Realtime needs a WebSocket global on Node versions below 22.
    if (typeof Reflect.get(globalThis, 'WebSocket') !== 'function') {
      Object.assign(globalThis, { WebSocket });
    }

    const clientOptions = {
      auth: { persistSession: false, autoRefreshToken: false },
    };

    this.publicClient = createClient(url, publishableKey, clientOptions);
    this.adminClient = createClient(url, secretKey, clientOptions);
  }

  async healthCheck(): Promise<void> {
    const { error } = await this.adminClient.from('companies').select('id').limit(1);
    if (error) throw new Error(`Supabase indisponível: ${error.message}`);
  }

  onModuleDestroy(): void {}
}
