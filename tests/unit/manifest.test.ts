import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

describe('PWA manifest', () => {
  it('declares a standalone localized application shell', () => {
    const value = manifest();

    expect(value.name).toBe('Life OS');
    expect(value.display).toBe('standalone');
    expect(value.start_url).toBe('/en');
  });
});
