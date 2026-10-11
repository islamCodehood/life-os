import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createActivityRuntime } from '@/src/infrastructure/composition/activity-runtime';
import { AppError } from '@/src/infrastructure/http/errors';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';
export async function GET(request: Request, { params }: { params: Promise<{ momentId: string }> }) {
  const requestId = createRequestId(request.headers.get('x-request-id'));
  try {
    const momentId = z
      .string()
      .uuid()
      .parse((await params).momentId);
    const rt = await createActivityRuntime(),
      actor = await rt.actorResolver.resolve(request);
    if (!actor) throw new AppError('AUTH_REQUIRED', 'Authentication is required.');
    if (actor.kind !== 'GUARDIAN')
      throw new AppError('FORBIDDEN', 'Guardian required for private revisions.');
    const history = await rt.moments.guardianHistory(actor, momentId);
    return NextResponse.json(history, {
      headers: { 'cache-control': 'no-store', 'x-request-id': requestId },
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
