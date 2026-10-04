import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { IdentityDomainError } from '@/src/application/identity/family-identity-service';
import { AppError, toApiError } from './errors';

export function errorResponse(error: unknown, requestId: string) {
  let mapped = error;

  if (error instanceof IdentityDomainError) {
    mapped = new AppError(error.code, error.message);
  } else if (error instanceof ZodError) {
    mapped = new AppError('VALIDATION_FAILED', 'Request structure is invalid.');
  }

  const { status, body } = toApiError(mapped, requestId);
  return NextResponse.json(body, { status, headers: { 'x-request-id': requestId } });
}
