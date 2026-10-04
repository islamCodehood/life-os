import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('service worker foundation', () => {
  it('explicitly bypasses non-GET requests', () => {
    const source = fs.readFileSync('public/sw.js', 'utf8');

    expect(source).toContain("request.method !== 'GET'");
    expect(source).not.toMatch(/caches\.put\([^\n]*POST/i);
  });
});
