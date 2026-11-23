import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { test } from 'node:test';
import { AuthUser } from '../common/auth-user';
import { SupabaseDataService } from '../supabase/supabase.service';
import { ChatService } from './chat.service';

const currentUser: AuthUser = {
  id: '00000000-0000-4000-8000-000000000001',
  companyId: '00000000-0000-4000-8000-000000000010',
  role: 'DEVELOPER',
  name: 'Current User',
  email: 'current@example.com',
  sessionId: 'session-test',
};

function createService(foundIds: string[]) {
  let createdData: {
    companyId: string;
    type: string;
    name: string;
    participants: { create: Array<{ userId: string }> };
  } | null = null;

  const prismaMock = {
    user: {
      findMany: async () => foundIds.map((id) => ({ id })),
    },
    conversation: {
      create: async ({ data }: { data: NonNullable<typeof createdData> }) => {
        createdData = data;
        return {
          id: 'group-conversation-id',
          name: data.name,
          type: data.type,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          participants: data.participants.create.map(({ userId }) => ({
            user: {
              id: userId,
              name: userId === currentUser.id ? currentUser.name : `Member ${userId}`,
              email: `${userId}@example.com`,
              jobTitle: null,
              active: true,
            },
          })),
        };
      },
    },
  };

  return {
    service: new ChatService(prismaMock as unknown as SupabaseDataService),
    getCreatedData: () => createdData,
  };
}

test('creates a named group with the creator and active company members', async () => {
  const memberIds = [
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
  ];
  const { service, getCreatedData } = createService(memberIds);

  const result = await service.createGroupConversation(currentUser, {
    name: '  Product team  ',
    participantIds: memberIds,
  });

  assert.equal(result.name, 'Product team');
  assert.equal(result.type, 'GROUP');
  assert.equal(result.participants.length, 3);
  assert.equal(getCreatedData()?.companyId, currentUser.companyId);
  assert.deepEqual(
    getCreatedData()?.participants.create.map(({ userId }) => userId),
    [currentUser.id, ...memberIds],
  );
});

test('rejects groups with fewer than two other members', async () => {
  const { service, getCreatedData } = createService([]);

  await assert.rejects(
    service.createGroupConversation(currentUser, {
      name: 'Product team',
      participantIds: [currentUser.id, '00000000-0000-4000-8000-000000000002'],
    }),
    BadRequestException,
  );
  assert.equal(getCreatedData(), null);
});

test('rejects members outside the active company roster', async () => {
  const { service, getCreatedData } = createService([
    '00000000-0000-4000-8000-000000000002',
  ]);

  await assert.rejects(
    service.createGroupConversation(currentUser, {
      name: 'Product team',
      participantIds: [
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
      ],
    }),
    BadRequestException,
  );
  assert.equal(getCreatedData(), null);
});
