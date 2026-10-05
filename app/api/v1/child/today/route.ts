import { NextResponse } from 'next/server';
import { createActivityRuntime } from '@/src/infrastructure/composition/activity-runtime';
import { AppError } from '@/src/infrastructure/http/errors';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';

export async function GET(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));

  try {
    const runtime = await createActivityRuntime();
    const actor = await runtime.actorResolver.resolve(request);
    if (!actor) throw new AppError('AUTH_REQUIRED', 'Authentication is required.');

    const today = await runtime.activities.getChildToday(actor);
    return NextResponse.json(today, {
      headers: {
        'x-request-id': requestId,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
