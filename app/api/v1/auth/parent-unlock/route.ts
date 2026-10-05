import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { FamilyId } from '@/src/domain/shared/id';
import { authCookieNames } from '@/src/infrastructure/auth/cookies';
import { encodeParentUnlock } from '@/src/infrastructure/auth/parent-unlock-codec';
import { createIdentityRuntime } from '@/src/infrastructure/composition/identity-runtime';
import { AppError } from '@/src/infrastructure/http/errors';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';

const schema = z.object({
  familyId: z.string().uuid(),
  password: z.string().min(1).max(512),
});

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));

  try {
    const input = schema.parse(await request.json());
    const runtime = await createIdentityRuntime();
    const identity = await runtime.guardianAuth.getCurrentGuardian();

    if (!identity || !identity.email) {
      throw new AppError('AUTH_REQUIRED', 'Guardian authentication is required.');
    }

    await runtime.guardianAuth.beginSignIn({
      email: identity.email,
      password: input.password,
    });

    const guardian = await runtime.repository.findGuardianByProviderUserId(identity.providerUserId);
    if (!guardian) {
      throw new AppError('FORBIDDEN', 'Guardian profile is not available.');
    }

    const familyId = input.familyId as FamilyId;
    const memberships = await runtime.repository.listGuardianMemberships(guardian.id);
    if (!memberships.some((membership) => membership.familyId === familyId)) {
      throw new AppError('FORBIDDEN', 'Guardian does not belong to this family.');
    }

    const expiresAtEpochSeconds =
      Math.floor(Date.now() / 1000) + runtime.env.PARENT_UNLOCK_TTL_SECONDS;
    const token = encodeParentUnlock(
      { familyId, guardianId: guardian.id, expiresAtEpochSeconds },
      runtime.env.CHILD_SESSION_HASH_SECRET!,
    );

    const response = NextResponse.json(
      { ok: true, expiresAt: new Date(expiresAtEpochSeconds * 1000).toISOString() },
      { headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } },
    );

    response.cookies.set(authCookieNames.parentUnlock, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: runtime.env.PARENT_UNLOCK_TTL_SECONDS,
    });
    response.cookies.set(authCookieNames.family, familyId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export function DELETE(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));
  const response = NextResponse.json(
    { ok: true },
    { headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } },
  );
  response.cookies.delete(authCookieNames.parentUnlock);
  return response;
}
