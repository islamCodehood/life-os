import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ActorContext } from '@/src/application/auth/actor-context';
import { commandRequestHash } from '@/src/application/commands/request-hash';
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

type RecordedActor = {
  actorKind: string;
  actorId: string | null;
  familyId: string | null;
};

function recordedActor(actor: ActorContext): RecordedActor {
  if (actor.kind === 'GUARDIAN') {
    return { actorKind: actor.kind, actorId: actor.guardianId, familyId: actor.familyId };
  }
  if (actor.kind === 'CHILD') {
    return { actorKind: actor.kind, actorId: actor.childId, familyId: actor.familyId };
  }
  return { actorKind: actor.kind, actorId: null, familyId: actor.familyId ?? null };
}

export async function executeIdempotentCommand<TResponse, TTransient = never>(input: {
  commandId: string;
  command: unknown;
  actor: ActorContext;
  recordActor?: RecordedActor;
  execute: (db: Db) => Promise<CommandExecution<TResponse, TTransient>>;
}): Promise<IdempotentCommandResult<TResponse, TTransient>> {
  const requestHash = commandRequestHash(input.command);
  const actorRecord = input.recordActor ?? recordedActor(input.actor);
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
        actorKind: actorRecord.actorKind,
        actorId: actorRecord.actorId,
        familyId: actorRecord.familyId,
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

      if (!existing) throw new AppError('INTERNAL_ERROR', 'Command state could not be resolved.');

      const sameActor =
        existing.actorKind === actorRecord.actorKind &&
        existing.actorId === actorRecord.actorId &&
        existing.familyId === actorRecord.familyId;

      if (existing.requestHash !== requestHash || !sameActor) {
        throw new AppError(
          'IDEMPOTENCY_KEY_REUSE',
          'This command ID was already used with different content or actor context.',
        );
      }

      if (existing.status !== 'ACCEPTED' || existing.responseJson === null) {
        throw new AppError('INTERNAL_ERROR', 'Command did not reach a reusable terminal state.');
      }

      await client.query('COMMIT');
      return { response: existing.responseJson as TResponse, replayed: true };
    }

    const execution = await input.execute(db);
    await db
      .update(schema.processedCommands)
      .set({ status: 'ACCEPTED', responseJson: execution.response, processedAt: new Date() })
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
