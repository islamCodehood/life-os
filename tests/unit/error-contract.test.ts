import { describe, expect, it } from 'vitest';
import { AppError, toApiError } from '@/src/infrastructure/http/errors';

describe('API error contract', () => {
  it('maps typed conflicts without leaking internals', () => {
    const result = toApiError(new AppError('CONFLICT', 'The resource changed.'), 'req-1');

    expect(result).toEqual({
      status: 409,
      body: {
        error: {
          code: 'CONFLICT',
          message: 'The resource changed.',
          requestId: 'req-1',
        },
      },
    });
  });

  it('hides unexpected error details', () => {
    const result = toApiError(new Error('database password=secret'), 'req-2');

    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).not.toContain('secret');
  });
});
