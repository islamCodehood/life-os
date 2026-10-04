export interface LogContext {
  requestId: string;
  commandId?: string;
  actorKind?: 'guardian' | 'child' | 'system' | 'anonymous';
  familyIdHash?: string;
  operation?: string;
  resultCode?: string;
  durationMs?: number;
}

function write(level: 'info' | 'warn' | 'error', event: string, context: LogContext) {
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...context,
  };

  const serialized = JSON.stringify(entry);

  if (level === 'error') {
    console.error(serialized);
    return;
  }

  if (level === 'warn') {
    console.warn(serialized);
    return;
  }

  console.info(serialized);
}

export const logger = {
  info(event: string, context: LogContext) {
    write('info', event, context);
  },
  warn(event: string, context: LogContext) {
    write('warn', event, context);
  },
  error(event: string, context: LogContext) {
    write('error', event, context);
  },
};
