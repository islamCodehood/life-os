import { createHash } from 'node:crypto';

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

export function commandRequestHash(command: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(command)))
    .digest('hex');
}
