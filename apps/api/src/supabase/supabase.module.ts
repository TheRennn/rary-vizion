import { Global, Module } from '@nestjs/common';
import { SupabaseDataService } from './supabase.service';

@Global()
@Module({ providers: [SupabaseDataService], exports: [SupabaseDataService] })
export class SupabaseModule {}
