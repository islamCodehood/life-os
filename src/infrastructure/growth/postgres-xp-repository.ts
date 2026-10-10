import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { XpRepository } from '@/src/application/growth/xp-repository';
import type { XpEntry, SkillKey } from '@/src/domain/growth/skill-xp';
import type { FamilyId, ChildId } from '@/src/domain/shared/id';
import * as schema from '@/src/infrastructure/database/schema';

type Db = NodePgDatabase<typeof schema>;
function toEntry(row: typeof schema.xpLedger.$inferSelect): XpEntry {
  if (row.skillKey !== 'READING' && row.skillKey !== 'CHESS')
    throw new Error('Unsupported skill key.');
  if (row.entryType !== 'GRANT' && row.entryType !== 'CORRECTION')
    throw new Error('Unsupported XP ledger entry type.');
  return {
    id: row.id,
    familyId: row.familyId,
    childId: row.childId,
    skillKey: row.skillKey as SkillKey,
    entryType: row.entryType,
    amount: row.amount,
    sourceEventId: row.sourceEventId,
    correctionOf: row.correctionOf,
    correctionReason: row.correctionReason,
    occurredAt: row.occurredAt,
    recordedAt: row.recordedAt,
  };
}
export class PostgresXpRepository implements XpRepository {
  constructor(private readonly db: Db) {}

  async append(entry: XpEntry) {
    await this.db.insert(schema.xpLedger).values({
      id: entry.id,
      familyId: entry.familyId,
      childId: entry.childId,
      skillKey: entry.skillKey,
      entryType: entry.entryType,
      amount: entry.amount,
      sourceEventId: entry.sourceEventId,
      correctionOf: entry.correctionOf,
      correctionReason: entry.correctionReason,
      occurredAt: entry.occurredAt,
      recordedAt: entry.recordedAt,
    });
  }

  async getEntry(familyId: FamilyId, id: string) {
    const [row] = await this.db
      .select()
      .from(schema.xpLedger)
      .where(and(eq(schema.xpLedger.familyId, familyId), eq(schema.xpLedger.id, id)))
      .limit(1);
    return row ? toEntry(row) : null;
  }

  async hasCorrection(familyId: FamilyId, grantId: string) {
    const [row] = await this.db
      .select({ id: schema.xpLedger.id })
      .from(schema.xpLedger)
      .where(and(eq(schema.xpLedger.familyId, familyId), eq(schema.xpLedger.correctionOf, grantId)))
      .limit(1);
    return !!row;
  }

  async listChildEntries(familyId: FamilyId, childId: ChildId) {
    const rows = await this.db
      .select()
      .from(schema.xpLedger)
      .where(and(eq(schema.xpLedger.familyId, familyId), eq(schema.xpLedger.childId, childId)))
      .orderBy(schema.xpLedger.recordedAt);
    return rows.map(toEntry);
  }
}
