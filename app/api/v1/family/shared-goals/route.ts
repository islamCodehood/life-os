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
    if (!actor || actor.kind === 'SYSTEM')
      throw new AppError('AUTH_REQUIRED', 'Family session required.');
    const visible = await runtime.goals.listVisible(actor);
    // Shared totals only — never expose contributor ranks or sibling-private goals.
    return NextResponse.json(
      { items: visible.filter((goal) => goal.ownerType === 'FAMILY') },
      { headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
