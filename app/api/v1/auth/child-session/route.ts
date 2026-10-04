import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { ChildId, DeviceId } from '@/src/domain/shared/id';
import { authCookieNames, parseCookieHeader } from '@/src/infrastructure/auth/cookies';
import { createIdentityRuntime } from '@/src/infrastructure/composition/identity-runtime';
import { AppError } from '@/src/infrastructure/http/errors';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';

const createSchema = z.object({
  childId: z.string().uuid(),
  deviceId: z.string().uuid(),
  pin: z.string().min(1).max(32),
});

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));

  try {
    const input = createSchema.parse(await request.json());
    const cookies = parseCookieHeader(request.headers.get('cookie'));
    const deviceToken = cookies.get(authCookieNames.householdDevice);

    if (!deviceToken) {
      throw new AppError('FORBIDDEN', 'This household device is not trusted.');
    }

    const runtime = await createIdentityRuntime();
    const { rawToken, session } = await runtime.childSessions.createSession({
      childId: input.childId as ChildId,
      deviceId: input.deviceId as DeviceId,
      deviceToken,
      pin: input.pin,
    });

    const response = NextResponse.json(
      {
        actor: {
          kind: 'CHILD',
          familyId: session.familyId,
          childId: session.childId,
          deviceId: session.deviceId,
        },
        expiresAt: session.expiresAt.toISOString(),
      },
      { headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } },
    );

    response.cookies.set(authCookieNames.childSession, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: session.expiresAt,
    });
    response.cookies.delete(authCookieNames.parentUnlock);

    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function DELETE(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));

  try {
    const cookies = parseCookieHeader(request.headers.get('cookie'));
    const rawToken = cookies.get(authCookieNames.childSession);
    if (rawToken) {
      const runtime = await createIdentityRuntime();
      await runtime.childSessions.revokeSessionByToken(rawToken);
    }

    const response = NextResponse.json(
      { ok: true },
      { headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } },
    );
    response.cookies.delete(authCookieNames.childSession);
    response.cookies.delete(authCookieNames.parentUnlock);
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
