import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('architecture boundaries', () => {
  it('rejects forbidden domain and client imports', () => {
    const output = execFileSync(process.execPath, ['scripts/check-architecture.mjs'], {
      encoding: 'utf8',
    });

    expect(output).toContain('Architecture import boundaries passed.');
  });
});
