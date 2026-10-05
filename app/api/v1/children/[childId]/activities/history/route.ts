import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { ChildId } from '@/src/domain/shared/id';
import { createActivityRuntime } from '@/src/infrastructure/composition/activity-runtime';
import { AppError } from '@/src/infrastructure/http/errors';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';

const childIdSchema = z.string().uuid();

export async function GET(request: Request, { params }: { params: Promise<{ childId: string }> }) {
  const requestId = createRequestId(request.headers.get('x-request-id'));

  try {
    const { childId: rawChildId } = await params;
    const childId = childIdSchema.parse(rawChildId) as ChildId;
    const runtime = await createActivityRuntime();
    const actor = await runtime.actorResolver.resolve(request);

    if (!actor) throw new AppError('AUTH_REQUIRED', 'Authentication is required.');

    const history = await runtime.activities.getParentHistory(actor, childId);
    return NextResponse.json(
      {
        childId,
        items: history.map((item) => ({
          completionId: item.completion.id,
          activityInstanceId: item.completion.activityInstanceId,
          templateKey: item.templateKey,
          title: item.title,
          occurredAt: item.completion.occurredAt.toISOString(),
          recordedAt: item.completion.recordedAt.toISOString(),
          selfInitiated: item.completion.selfInitiated,
          targetAt: item.targetAt.toISOString(),
        })),
      },
      { headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
