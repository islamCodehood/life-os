export const authCookieNames = {
  childSession: 'lifeos_child_session',
  householdDevice: 'lifeos_household_device',
  family: 'lifeos_family',
  parentUnlock: 'lifeos_parent_unlock',
} as const;

export function parseCookieHeader(header: string | null): Map<string, string> {
  const result = new Map<string, string>();
  if (!header) return result;

  for (const segment of header.split(';')) {
    const index = segment.indexOf('=');
    if (index <= 0) continue;
    const name = segment.slice(0, index).trim();
    const value = segment.slice(index + 1).trim();
    if (name) result.set(name, decodeURIComponent(value));
  }

  return result;
}
