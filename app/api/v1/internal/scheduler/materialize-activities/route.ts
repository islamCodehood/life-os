import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ActivityService } from '@/src/application/activity/activity-service';
import { AuthorizationService } from '@/src/application/identity/authorization-service';
import { PostgresActivityRepository } from '@/src/infrastructure/activity/postgres-activity-repository';
import { getDatabase } from '@/src/infrastructure/database/client';
import { getServerEnv } from '@/src/infrastructure/env/server';
import { AppError } from '@/src/infrastructure/http/errors';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { errorResponse } from '@/src/infrastructure/http/route-error';
import { PostgresIdentityRepository } from '@/src/infrastructure/identity/postgres-identity-repository';

function matchesSecret(header: string | null, secret: string) {
  if (!header?.startsWith('Bearer ')) return false;
  const supplied = header.slice('Bearer '.length);
  const left = Buffer.from(supplied);
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const requestId = createRequestId(request.headers.get('x-request-id'));

  try {
    const env = getServerEnv();
    if (!env.INTERNAL_SCHEDULER_SECRET) {
      throw new AppError('INTERNAL_ERROR', 'Scheduler secret is not configured.');
    }
    if (!matchesSecret(request.headers.get('authorization'), env.INTERNAL_SCHEDULER_SECRET)) {
      throw new AppError('FORBIDDEN', 'Scheduler authorization failed.');
    }

    const db = getDatabase().db;
    const identityRepository = new PostgresIdentityRepository(db);
    const activityRepository = new PostgresActivityRepository(db);
    const activities = new ActivityService(
      activityRepository,
      identityRepository,
      new AuthorizationService(identityRepository),
    );

    const result = await activities.materializeCurrentForAllFamilies();
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { 'x-request-id': requestId, 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
