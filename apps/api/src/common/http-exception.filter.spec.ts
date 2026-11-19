import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function invokeFilter(exception: unknown) {
  let statusCode = 0;
  let payload: unknown;
  const request = {
    requestId: 'request-test-123',
    method: 'GET',
    originalUrl: '/api/example?secret=value',
  };
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as never;

  new HttpExceptionFilter().catch(exception, host);
  return { statusCode, payload: payload as Record<string, unknown> };
}

test('formats HTTP exceptions with request context and without query parameters', () => {
  const result = invokeFilter(new HttpException({ message: 'Entrada inválida' }, HttpStatus.BAD_REQUEST));

  assert.equal(result.statusCode, HttpStatus.BAD_REQUEST);
  assert.equal(result.payload.message, 'Entrada inválida');
  assert.equal(result.payload.requestId, 'request-test-123');
  assert.equal(result.payload.path, '/api/example');
  assert.equal(result.payload.statusCode, HttpStatus.BAD_REQUEST);
  assert.equal(typeof result.payload.timestamp, 'string');
});

test('hides unexpected exception details behind a generic server error', () => {
  const result = invokeFilter(new Error('database password leaked'));

  assert.equal(result.statusCode, HttpStatus.INTERNAL_SERVER_ERROR);
  assert.equal(result.payload.message, 'Erro interno do servidor');
  assert.equal(result.payload.path, '/api/example');
});
