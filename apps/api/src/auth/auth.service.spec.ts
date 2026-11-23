import assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { test } from 'node:test';
import { SupabaseDataService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';

test('dev login confirma a conta existente, sincroniza a senha e garante perfil OWNER ativo', async () => {
  let authUpdate: unknown;
  let profileUpdate: unknown;
  let signIn: unknown;
  const supabase = {
    development: true,
    local: false,
    adminClient: {
      auth: {
        admin: {
          listUsers: async () => ({ data: { users: [{ id: 'demo-id', email: 'OWNER@demo.com' }] }, error: null }),
          updateUserById: async (id: string, attributes: unknown) => {
            assert.equal(id, 'demo-id');
            authUpdate = attributes;
            return { data: { user: { id } }, error: null };
          },
        },
      },
      from: (table: string) => {
        assert.equal(table, 'users');
        return {
          update: (attributes: unknown) => {
            profileUpdate = attributes;
            return {
              eq: (field: string, id: string) => {
                assert.equal(field, 'id');
                assert.equal(id, 'demo-id');
                return {
                  select: (columns: string) => {
                    assert.equal(columns, 'id');
                    return { maybeSingle: async () => ({ data: { id }, error: null }) };
                  },
                };
              },
            };
          },
        };
      },
    },
    publicClient: {
      auth: {
        signInWithPassword: async (credentials: unknown) => {
          signIn = credentials;
          return {
            data: {
              session: { access_token: 'access', refresh_token: 'refresh', expires_at: 1_900_000_000 },
              user: { id: 'demo-id' },
            },
            error: null,
          };
        },
      },
    },
  };
  const service = new AuthService(
    { get: (key: string) => key === 'DEV_DEMO_PASSWORD' ? 'Demo@12345' : undefined } as ConfigService,
    supabase as unknown as SupabaseDataService,
  );

  const session = await service.devLogin();

  assert.deepEqual(authUpdate, { password: 'Demo@12345', email_confirm: true });
  assert.deepEqual(profileUpdate, { role: 'OWNER', active: true });
  assert.deepEqual(signIn, { email: 'owner@demo.com', password: 'Demo@12345' });
  assert.equal(session.token, 'access');
});

test('dev login is unavailable unless Supabase is explicitly local or development', async () => {
  const service = new AuthService(
    { get: () => undefined } as unknown as ConfigService,
    { development: false, local: false } as unknown as SupabaseDataService,
  );

  await assert.rejects(service.devLogin(), NotFoundException);
});
