export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'STALE_VERSION'
  | 'IDEMPOTENCY_KEY_REUSE'
  | 'RESOURCE_STATE_CHANGED'
  | 'JOB_TERMS_CHANGED'
  | 'DOMAIN_RULE_VIOLATION'
  | 'INSUFFICIENT_FUNDS'
  | 'RATE_LIMITED'
  | 'CLIENT_UPDATE_REQUIRED'
  | 'INTERNAL_ERROR';

const statusByCode: Record<ApiErrorCode, number> = {
  VALIDATION_FAILED: 400,
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  RESOURCE_NOT_FOUND: 404,
  STALE_VERSION: 409,
  IDEMPOTENCY_KEY_REUSE: 409,
  RESOURCE_STATE_CHANGED: 409,
  JOB_TERMS_CHANGED: 409,
  DOMAIN_RULE_VIOLATION: 422,
  INSUFFICIENT_FUNDS: 422,
  RATE_LIMITED: 429,
  CLIENT_UPDATE_REQUIRED: 426,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export function toApiError(
  error: unknown,
  requestId: string,
): {
  status: number;
  body: ApiErrorBody;
} {
  if (error instanceof AppError) {
    return {
      status: statusByCode[error.code],
      body: {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        requestId,
      },
    },
  };
}
