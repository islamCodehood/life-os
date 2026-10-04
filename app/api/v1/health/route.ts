import { NextResponse } from 'next/server';
import { createRequestId } from '@/src/infrastructure/http/request-id';
import { logger } from '@/src/infrastructure/logging/logger';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const startedAt = performance.now();
  const requestId = createRequestId(request.headers.get('x-request-id'));

  logger.info('health_check', {
    requestId,
    operation: 'GET /api/v1/health',
    resultCode: 'ok',
    durationMs: Math.round(performance.now() - startedAt),
  });

  return NextResponse.json(
    {
      ok: true,
      service: 'life-os',
      requestId,
    },
    {
      headers: {
        'x-request-id': requestId,
        'cache-control': 'no-store',
      },
    },
  );
}
