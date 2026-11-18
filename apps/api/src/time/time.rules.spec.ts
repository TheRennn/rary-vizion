import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeWorkedSeconds, statusFromLastEntry } from './time.rules';

const at = (hhmm: string) => new Date(`2026-01-05T${hhmm}:00.000Z`);

test('status derivado do último registro', () => {
  assert.equal(statusFromLastEntry(undefined), 'OFFLINE');
  assert.equal(statusFromLastEntry('CLOCK_IN'), 'WORKING');
  assert.equal(statusFromLastEntry('BREAK_START'), 'ON_BREAK');
  assert.equal(statusFromLastEntry('BREAK_END'), 'WORKING');
  assert.equal(statusFromLastEntry('CLOCK_OUT'), 'OFFLINE');
});

test('jornada fechada desconta o intervalo', () => {
  const entries = [
    { type: 'CLOCK_IN' as const, recordedAt: at('08:00') },
    { type: 'BREAK_START' as const, recordedAt: at('12:00') },
    { type: 'BREAK_END' as const, recordedAt: at('13:00') },
    { type: 'CLOCK_OUT' as const, recordedAt: at('17:00') },
  ];
  assert.equal(computeWorkedSeconds(entries, at('23:00')), 8 * 3600);
});

test('jornada em andamento conta até agora', () => {
  const entries = [{ type: 'CLOCK_IN' as const, recordedAt: at('08:00') }];
  assert.equal(computeWorkedSeconds(entries, at('09:30')), 90 * 60);
});

test('sem registros retorna zero', () => {
  assert.equal(computeWorkedSeconds([], at('09:00')), 0);
});
