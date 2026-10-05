import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createGuardianAuthGateway } from '@/src/infrastructure/auth/supabase-guardian-auth-gateway';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(512),
});

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));

  try {
    const input = schema.parse(await request.json());
    const gateway = await createGuardianAuthGateway();
    await gateway.beginSignIn(input);
    return NextResponse.json(
      { ok: true, requestId },
      { headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
