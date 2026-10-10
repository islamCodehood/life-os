import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ActivityDomainError } from '@/src/application/activity/activity-service';
import { GraduationDomainError } from '@/src/application/graduation/graduation-service';
import { GoalDomainError } from '@/src/application/goals/goal-service';
import { MoneyDomainError } from '@/src/application/money/money-service';
import { JobDomainError } from '@/src/application/jobs/job-service';
import { GuardianAuthenticationError } from '@/src/application/auth/guardian-auth-gateway';
import { IdentityDomainError } from '@/src/application/identity/family-identity-service';
import { AppError, toApiError } from './errors';

export function errorResponse(error: unknown, requestId: string) {
  let mapped = error;

  if (
    error instanceof ActivityDomainError ||
    error instanceof GraduationDomainError ||
    error instanceof GoalDomainError ||
    error instanceof MoneyDomainError ||
    error instanceof JobDomainError ||
    error instanceof IdentityDomainError
  ) {
    mapped = new AppError(error.code, error.message);
  } else if (error instanceof GuardianAuthenticationError) {
    mapped = new AppError('AUTH_REQUIRED', 'Guardian authentication failed.');
  } else if (error instanceof ZodError) {
    mapped = new AppError('VALIDATION_FAILED', 'Request structure is invalid.');
  }

  const { status, body } = toApiError(mapped, requestId);
  return NextResponse.json(body, { status, headers: { 'x-request-id': requestId } });
}
