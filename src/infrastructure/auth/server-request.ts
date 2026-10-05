import { headers } from 'next/headers';
import { publicEnv } from '@/src/infrastructure/env/public';

export async function currentServerRequest(path = '/') {
  const source = await headers();
  const copied = new Headers();
  source.forEach((value, key) => copied.set(key, value));
  return new Request(new URL(path, publicEnv.NEXT_PUBLIC_APP_ORIGIN), { headers: copied });
}
