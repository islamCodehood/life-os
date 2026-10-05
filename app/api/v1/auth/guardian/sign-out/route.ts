import { NextResponse } from 'next/server';
import { createGuardianAuthGateway } from '@/src/infrastructure/auth/supabase-guardian-auth-gateway';
import { authCookieNames } from '@/src/infrastructure/auth/cookies';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));

  try {
    const gateway = await createGuardianAuthGateway();
    await gateway.signOut();
    const response = NextResponse.json(
      { ok: true, requestId },
      { headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } },
    );
    response.cookies.delete(authCookieNames.parentUnlock);
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
