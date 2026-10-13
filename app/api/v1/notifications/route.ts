import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createActivityRuntime } from '@/src/infrastructure/composition/activity-runtime';
import { getDatabase } from '@/src/infrastructure/database/client';
import { Notifications } from '@/src/infrastructure/notifications/notifications';
import { AppError } from '@/src/infrastructure/http/errors';
import { errorResponse } from '@/src/infrastructure/http/route-error';
import { createRequestId } from '@/src/infrastructure/http/request-id';
const schema = z
  .object({ enabled: z.boolean(), quietStart: z.string(), quietEnd: z.string() })
  .strict();
export async function GET(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));
  try {
    const rt = await createActivityRuntime(),
      actor = await rt.actorResolver.resolve(request);
    if (!actor || actor.kind === 'SYSTEM')
      throw new AppError('AUTH_REQUIRED', 'Family session required.');
    const result = await new Notifications(getDatabase().db).view(actor);
    return NextResponse.json(result, {
      headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId },
    });
  } catch (e) {
    return errorResponse(e, requestId);
  }
}
export async function PUT(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));
  try {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin)
      throw new AppError('FORBIDDEN', 'Same-origin request required.');
    const rt = await createActivityRuntime(),
      actor = await rt.actorResolver.resolve(request);
    if (!actor || actor.kind === 'SYSTEM')
      throw new AppError('AUTH_REQUIRED', 'Family session required.');
    const payload = schema.parse(await request.json());
    const result = await new Notifications(getDatabase().db).setPreferences(actor, payload);
    return NextResponse.json(result, {
      headers: { 'cache-control': 'no-store', 'x-request-id': requestId },
    });
  } catch (e) {
    return errorResponse(e, requestId);
  }
}
