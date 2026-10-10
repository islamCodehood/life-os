import { NextResponse } from 'next/server';
import { createActivityRuntime } from '@/src/infrastructure/composition/activity-runtime';
import { AppError } from '@/src/infrastructure/http/errors';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';
import { currentDateInTimezone } from '@/src/application/identity/current-date';
export async function GET(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));
  try {
    const rt = await createActivityRuntime(),
      actor = await rt.actorResolver.resolve(request);
    if (!actor) throw new AppError('AUTH_REQUIRED', 'Authentication is required.');
    if (actor.kind !== 'CHILD') throw new AppError('FORBIDDEN', 'A child session is required.');
    const family = await rt.repository.getFamily(actor.familyId);
    if (!family) throw new AppError('RESOURCE_NOT_FOUND', 'Family not found.');
    const profile = (
      await rt.repository.listChildSummaries(actor.familyId, currentDateInTimezone(family.timezone))
    ).find((p) => p.id === actor.childId);
    const story = await rt.moments.story(
      actor,
      actor.childId,
      new Date(),
      profile?.experience.visualization,
    );
    return NextResponse.json(story, {
      headers: { 'cache-control': 'no-store', 'x-request-id': requestId },
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
