const requestIdPattern = /^[A-Za-z0-9._:-]{1,100}$/;

export function createRequestId(candidate?: string | null): string {
  if (candidate && requestIdPattern.test(candidate)) {
    return candidate;
  }

  return crypto.randomUUID();
}
