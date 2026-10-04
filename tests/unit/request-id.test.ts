import { describe, expect, it } from 'vitest';
import { createRequestId } from '@/src/infrastructure/http/request-id';

describe('request IDs', () => {
  it('preserves a safe incoming request ID', () => {
    expect(createRequestId('edge-abc_123')).toBe('edge-abc_123');
  });

  it('replaces unsafe input', () => {
    const id = createRequestId('bad request id with spaces');
    expect(id).not.toBe('bad request id with spaces');
    expect(id.length).toBeGreaterThan(10);
  });
});
