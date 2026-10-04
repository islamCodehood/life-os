import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ActorContext } from '@/src/application/auth/actor-context';
import { getDatabase } from '@/src/infrastructure/database/client';
import * as schema from '@/src/infrastructure/database/schema';
import { AppError } from '@/src/infrastructure/http/errors';

type Db = NodePgDatabase<typeof schema>;

export interface CommandExecution<TResponse, TTransient = never> {
  response: TResponse;
  transient?: TTransient;
}

export interface IdempotentCommandResult<TResponse, TTransient = never> {
  response: TResponse;
  transient?: TTransient;
  replayed: boolean;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

export function commandRequestHash(command: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableValue(command))).digest('hex');
}

function actorId(actor: ActorContext): string | null {
  if (actor.kind === 'GUARDIAN') return actor.guardianId;
  if (actor.kind === 'CHILD') return actor.childId;
  return null;
}

export async function executeIdempotentCommand<TResponse, TTransient = never>(input: {
  commandId: string;
  command: unknown;
  actor: ActorContext;
  execute: (db: Db) => Promise<CommandExecution<TResponse, TTransient>>;
}): Promise<IdempotentCommandResult<TResponse, TTransient>> {
  const requestHash = commandRequestHash(input.command);
  const { pool } = getDatabase();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const db = drizzle(client, { schema });

    const inserted = await db
      .insert(schema.processedCommands)
      .values({
        commandId: input.commandId,
        requestHash,
        actorKind: input.actor.kind,
        actorId: actorId(input.actor),
        familyId: input.actor.familyId ?? null,
        status: 'PROCESSING',
      })
      .onConflictDoNothing()
      .returning({ commandId: schema.processedCommands.commandId });

    if (inserted.length === 0) {
      const [existing] = await db
        .select()
        .from(schema.processedCommands)
        .where(eq(schema.processedCommands.commandId, input.commandId))
        .limit(1);

      if (!existing) {
        throw new AppError('INTERNAL_ERROR', 'Command state could not be resolved.');
      }
      if (existing.requestHash !== requestHash) {
        throw new AppError(
          'IDEMPOTENCY_KEY_REUSE',
          'This command ID was already used with different content.',
        );
      }
      if (existing.status !== 'ACCEPTED' || existing.responseJson === null) {
        throw new AppError('INTERNAL_ERROR', 'Command did not reach a reusable terminal state.');
      }

      await client.query('COMMIT');
      return {
        response: existing.responseJson as TResponse,
        replayed: true,
      };
    }

    const execution = await input.execute(db);
    await db
      .update(schema.processedCommands)
      .set({
        status: 'ACCEPTED',
        responseJson: execution.response,
        processedAt: new Date(),
      })
      .where(eq(schema.processedCommands.commandId, input.commandId));

    await client.query('COMMIT');
    return {
      response: execution.response,
      ...(execution.transient === undefined ? {} : { transient: execution.transient }),
      replayed: false,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
