import type {
  AcceptedCommandResponse,
  CommandTransport,
  CommandTransportResult,
  OfflineCommandRecord,
} from '@/src/offline/model';

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
}

async function responseError(response: Response) {
  try {
    const body = (await response.json()) as ErrorEnvelope;
    return {
      code: body.error?.code ?? `HTTP_${response.status}`,
      message: body.error?.message ?? 'The command could not be accepted.',
      ...(body.error?.requestId ? { requestId: body.error.requestId } : {}),
    };
  } catch {
    return {
      code: `HTTP_${response.status}`,
      message: 'The command could not be accepted.',
    };
  }
}

export class HttpCommandTransport implements CommandTransport {
  async send(command: OfflineCommandRecord, signal?: AbortSignal): Promise<CommandTransportResult> {
    try {
      const response = await fetch('/api/v1/commands', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          commandId: command.commandId,
          schemaVersion: command.schemaVersion,
          type: command.type,
          occurredAt: command.occurredAt,
          clientSequence: command.clientSequence,
          expectedVersions: command.expectedVersions,
          payload: command.payload,
        }),
        ...(signal ? { signal } : {}),
      });

      if (response.ok) {
        return {
          kind: 'ACCEPTED',
          response: (await response.json()) as AcceptedCommandResponse,
        };
      }

      const error = await responseError(response);

      if (
        response.status === 409 &&
        (error.code === 'STALE_VERSION' || error.code === 'RESOURCE_STATE_CHANGED')
      ) {
        return { kind: 'CONFLICT', ...error };
      }

      if (response.status === 429 || response.status >= 500) {
        return { kind: 'RETRYABLE', code: error.code, message: error.message };
      }

      return { kind: 'REJECTED', ...error };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { kind: 'ABORTED' };
      }

      return {
        kind: 'RETRYABLE',
        code: 'NETWORK_UNAVAILABLE',
        message: 'The network is unavailable.',
      };
    }
  }
}
