import { and, desc, eq, inArray, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as s from '@/src/infrastructure/database/schema';
import { newId } from '@/src/domain/shared/id';
import type { Moment, MomentRevision, ValueTag, MomentSnapshot } from '@/src/domain/moments/moment';
import type { MomentRepository } from '@/src/application/moments/moment-repository';
type Db = NodePgDatabase<typeof s>;
function dbMoment(row: typeof s.moments.$inferSelect, tags: ValueTag[]): Moment {
  return {
    ...row,
    authorKind: row.authorKind as Moment['authorKind'],
    privacy: row.privacy as Moment['privacy'],
    status: row.status as Moment['status'],
    tags,
  };
}
function saveMoment(moment: Moment) {
  const { tags, ...row } = moment;
  void tags;
  return row;
}
export class PostgresMomentRepository implements MomentRepository {
  constructor(private readonly db: Db) {}
  private async withTags(rows: (typeof s.moments.$inferSelect)[]): Promise<Moment[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const all = await this.db
      .select()
      .from(s.momentTags)
      .where(
        and(eq(s.momentTags.familyId, rows[0]!.familyId), inArray(s.momentTags.momentId, ids)),
      );
    return rows.map((row) =>
      dbMoment(
        row,
        all
          .filter((t) => t.momentId === row.id && t.momentVersion === row.version)
          .map((t) => t.tag as ValueTag),
      ),
    );
  }
  private async insertTags(moment: Moment) {
    if (moment.tags.length)
      await this.db.insert(s.momentTags).values(
        moment.tags.map((tag) => ({
          id: newId<'MomentTagId'>(),
          familyId: moment.familyId,
          momentId: moment.id,
          momentVersion: moment.version,
          tag,
        })),
      );
  }
  async insert(moment: Moment) {
    await this.db.insert(s.moments).values(saveMoment(moment));
    await this.insertTags(moment);
  }
  async lock(familyId: string, momentId: string) {
    const [row] = await this.db
      .select()
      .from(s.moments)
      .where(and(eq(s.moments.familyId, familyId), eq(s.moments.id, momentId)))
      .for('update')
      .limit(1);
    if (!row) return null;
    const [moment] = await this.withTags([row]);
    return moment ?? null;
  }
  async listForChild(familyId: string, childId: string) {
    const rows = await this.db
      .select()
      .from(s.moments)
      .where(
        and(
          eq(s.moments.familyId, familyId),
          eq(s.moments.status, 'PUBLISHED'),
          or(
            eq(s.moments.privacy, 'FAMILY_SHARED'),
            and(eq(s.moments.privacy, 'CHILD_SAFE'), eq(s.moments.subjectChildId, childId)),
          ),
        ),
      )
      .orderBy(desc(s.moments.occurredAt))
      .limit(100);
    return this.withTags(rows);
  }
  async listForGuardian(familyId: string, childId?: string) {
    const rows = await this.db
      .select()
      .from(s.moments)
      .where(
        and(
          eq(s.moments.familyId, familyId),
          ...(childId ? [eq(s.moments.subjectChildId, childId)] : []),
        ),
      )
      .orderBy(desc(s.moments.occurredAt))
      .limit(200);
    return this.withTags(rows);
  }
  async update(moment: Moment, expectedVersion: number) {
    const [row] = await this.db
      .update(s.moments)
      .set({ ...saveMoment(moment) })
      .where(
        and(
          eq(s.moments.familyId, moment.familyId),
          eq(s.moments.id, moment.id),
          eq(s.moments.version, expectedVersion),
          eq(s.moments.status, 'PUBLISHED'),
        ),
      )
      .returning();
    if (!row) return null;
    await this.insertTags(moment);
    return dbMoment(row, [...moment.tags]);
  }
  async appendRevision(revision: MomentRevision) {
    await this.db.insert(s.momentRevisions).values({
      id: revision.id,
      familyId: revision.familyId,
      momentId: revision.momentId,
      version: revision.version,
      action: revision.action,
      beforeSnapshot: revision.before,
      afterSnapshot: revision.after,
      editedByKind: revision.editedByKind,
      editedAt: revision.editedAt,
      reason: revision.reason,
    });
  }
  async revisions(familyId: string, momentId: string) {
    const rows = await this.db
      .select()
      .from(s.momentRevisions)
      .where(
        and(eq(s.momentRevisions.familyId, familyId), eq(s.momentRevisions.momentId, momentId)),
      )
      .orderBy(s.momentRevisions.version);
    return rows.map((r): MomentRevision => ({
      id: r.id,
      familyId: r.familyId,
      momentId: r.momentId,
      version: r.version,
      action: r.action as MomentRevision['action'],
      before: r.beforeSnapshot as MomentSnapshot | null,
      after: r.afterSnapshot as MomentSnapshot,
      editedByKind: r.editedByKind as MomentRevision['editedByKind'],
      editedAt: r.editedAt,
      reason: r.reason,
    }));
  }
}
