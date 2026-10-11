import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createActivityRuntime } from '@/src/infrastructure/composition/activity-runtime';
import { AppError } from '@/src/infrastructure/http/errors';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';
export async function GET(request: Request, { params }: { params: Promise<{ childId: string }> }) {
  const requestId = createRequestId(request.headers.get('x-request-id'));
  try {
    const childId = z
      .string()
      .uuid()
      .parse((await params).childId);
    const rt = await createActivityRuntime(),
      actor = await rt.actorResolver.resolve(request);
    if (!actor) throw new AppError('AUTH_REQUIRED', 'Authentication is required.');
    if (actor.kind !== 'GUARDIAN') throw new AppError('FORBIDDEN', 'Guardian required.');
    const items = await rt.moments.listGuardian(actor, childId);
    return NextResponse.json(
      { childId, items },
      { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
