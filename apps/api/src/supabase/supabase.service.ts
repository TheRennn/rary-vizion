import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

@Injectable()
export class SupabaseService implements OnModuleDestroy {
  readonly publicClient: SupabaseClient;
  readonly adminClient: SupabaseClient;
  private readonly configured: boolean;

  get isConfigured(): boolean {
    return this.configured;
  }

  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL');
    const publishableKey = config.get<string>('SUPABASE_PUBLISHABLE_KEY');
    const secretKey = config.get<string>('SUPABASE_SECRET_KEY');
    this.configured = !!url &&
      !url.includes('SEU-PROJETO') &&
      !!publishableKey &&
      publishableKey !== 'sb_publishable_...' &&
      !!secretKey &&
      secretKey !== 'sb_secret_...';
    // Supabase Realtime needs a WebSocket global on Node versions below 22.
    if (typeof Reflect.get(globalThis, 'WebSocket') !== 'function') {
      Object.assign(globalThis, { WebSocket });
    }

    const clientOptions = {
      auth: { persistSession: false, autoRefreshToken: false },
    };

    const fallbackUrl = 'https://demo.supabase.invalid';
    const fallbackKey = 'demo-placeholder';
    this.publicClient = createClient(this.configured ? url! : fallbackUrl, this.configured ? publishableKey! : fallbackKey, clientOptions);
    this.adminClient = createClient(this.configured ? url! : fallbackUrl, this.configured ? secretKey! : fallbackKey, clientOptions);
  }

  async healthCheck(): Promise<void> {
    // Contas demo e recursos locais não dependem do Supabase.
    // Quando for necessário validar uma integração real, use a configuração
    // da aplicação e remova este retorno no fluxo de produção.
    return;
  }

  onModuleDestroy(): void {}
}
