import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeWork } from './dashboard.metrics';

const at = (value: string) => new Date(value);

test('resume horas trabalhadas sem contar os intervalos', () => {
  const from = at('2026-01-05T00:00:00.000Z');
  const summary = summarizeWork(
    [
      { id: '1', userId: 'u1', type: 'CLOCK_IN', recordedAt: at('2026-01-05T08:00:00.000Z') },
      { id: '2', userId: 'u1', type: 'BREAK_START', recordedAt: at('2026-01-05T12:00:00.000Z') },
      { id: '3', userId: 'u1', type: 'BREAK_END', recordedAt: at('2026-01-05T13:00:00.000Z') },
      { id: '4', userId: 'u1', type: 'CLOCK_OUT', recordedAt: at('2026-01-05T17:00:00.000Z') },
    ],
    from,
    at('2026-01-04T00:00:00.000Z'),
    at('2026-01-05T18:00:00.000Z'),
    1,
  );

  assert.equal(summary.workedSeconds, 8 * 3600);
  assert.equal(summary.trend[0].workedSeconds, 8 * 3600);
  assert.equal(summary.trend[0].starts, 1);
  assert.equal(summary.trend[0].ends, 1);
});

test('limita jornadas abertas aos períodos e mantém o intervalo anterior separado', () => {
  const from = at('2026-01-02T00:00:00.000Z');
  const summary = summarizeWork(
    [
      { id: '1', userId: 'u1', type: 'CLOCK_IN', recordedAt: at('2026-01-01T23:00:00.000Z') },
      { id: '2', userId: 'u1', type: 'BREAK_START', recordedAt: at('2026-01-02T02:00:00.000Z') },
      { id: '3', userId: 'u1', type: 'BREAK_END', recordedAt: at('2026-01-02T02:30:00.000Z') },
    ],
    from,
    at('2026-01-01T00:00:00.000Z'),
    at('2026-01-02T10:00:00.000Z'),
    1,
  );

  assert.equal(summary.previousWorkedSeconds, 3600);
  assert.equal(summary.workedSeconds, 9.5 * 3600);
  assert.equal(summary.employeeWorkedSeconds.u1, 9.5 * 3600);
});

test('retorna séries vazias em zero para empresas sem registros', () => {
  const summary = summarizeWork(
    [],
    at('2026-01-01T00:00:00.000Z'),
    at('2025-12-31T00:00:00.000Z'),
    at('2026-01-01T12:00:00.000Z'),
    7,
  );

  assert.equal(summary.workedSeconds, 0);
  assert.equal(summary.trend.length, 7);
  assert.ok(summary.trend.every((point) => point.workedSeconds === 0));
});
