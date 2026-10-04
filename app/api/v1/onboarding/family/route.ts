import { NextResponse } from 'next/server';
import { createFamilyCommandSchema } from '@/src/application/identity/e1-command-schema';
import { authCookieNames } from '@/src/infrastructure/auth/cookies';
import { createIdentityRuntime } from '@/src/infrastructure/composition/identity-runtime';
import { AppError } from '@/src/infrastructure/http/errors';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));

  try {
    const command = createFamilyCommandSchema.parse(await request.json());
    const runtime = await createIdentityRuntime();
    const identity = await runtime.guardianAuth.getCurrentGuardian();

    if (!identity) throw new AppError('AUTH_REQUIRED', 'Guardian authentication is required.');

    const result = await runtime.familyIdentity.createFamily(identity, command.payload);
    const response = NextResponse.json(
      {
        commandId: command.commandId,
        status: 'ACCEPTED',
        serverTime: new Date().toISOString(),
        data: { family: result.family },
        effects: [],
      },
      { status: 201, headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } },
    );

    response.cookies.set(authCookieNames.family, result.family.id, {
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
