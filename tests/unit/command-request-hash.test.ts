import { describe, expect, it } from 'vitest';
import { commandRequestHash } from '@/src/application/commands/request-hash';

describe('command request hashing', () => {
  it('is stable across object key order', () => {
    const left = commandRequestHash({
      commandId: '01900000-0000-7000-8000-000000000001',
      payload: { name: 'Family', currency: 'EGP' },
    });
    const right = commandRequestHash({
      payload: { currency: 'EGP', name: 'Family' },
      commandId: '01900000-0000-7000-8000-000000000001',
    });
    expect(left).toBe(right);
  });

  it('changes when command content changes', () => {
    expect(commandRequestHash({ pin: '1234' })).not.toBe(commandRequestHash({ pin: '9999' }));
  });
});
