import type { ActorContext } from '@/src/application/auth/actor-context';
import type { IdentityRepository } from '@/src/application/identity/identity-repository';
import type { ChildId } from '@/src/domain/shared/id';
import {
  emptyWorld,
  projectWorld,
  type WorldFact,
  type WorldStateDto,
  type WorldScope,
} from '@/src/domain/visual-world/world';
import type { WorldRepository } from './world-repository';
export class WorldAccessError extends Error {
  constructor(
    readonly code: 'FORBIDDEN' | 'RESOURCE_NOT_FOUND',
    message: string,
  ) {
    super(message);
  }
}
export class WorldService {
  constructor(
    private readonly repo: WorldRepository,
    private readonly identity: IdentityRepository,
  ) {}
  async read(
    actor: ActorContext,
    scope: WorldScope,
    childId: string | null,
    now = new Date(),
  ): Promise<WorldStateDto> {
    if (actor.kind === 'SYSTEM') throw new WorldAccessError('FORBIDDEN', 'Family actor required.');
    const family = await this.identity.getFamily(actor.familyId);
    if (!family) throw new WorldAccessError('RESOURCE_NOT_FOUND', 'Family not found.');
    if (scope === 'PERSONAL') {
      if (!childId) throw new WorldAccessError('RESOURCE_NOT_FOUND', 'Child not found.');
      if (actor.kind === 'CHILD' && actor.childId !== childId)
        throw new WorldAccessError('RESOURCE_NOT_FOUND', 'World not found.');
      if (!(await this.identity.getChild(actor.familyId, childId as ChildId)))
        throw new WorldAccessError('RESOURCE_NOT_FOUND', 'World not found.');
    } else if (childId !== null) {
      throw new WorldAccessError(
        'RESOURCE_NOT_FOUND',
        'Family World has no individual child owner.',
      );
    }
    const facts = await this.repo.sourceFacts(actor.familyId);
    const matching = facts.filter(
      (f) => f.scope === scope && (scope === 'FAMILY' || f.childId === childId),
    );
    // Read-through backfill from canonical domain truth; first projection is idempotently persisted.
    // Inactive/archived or corrected source facts are excluded before materialization and rendering.
    const firstPerMilestone = new Map<string, WorldFact>();
    for (const candidate of [...matching].sort(
      (a, b) =>
        a.occurredAt.getTime() - b.occurredAt.getTime() ||
        a.sourceEventId.localeCompare(b.sourceEventId),
    )) {
      const key = candidate.scope + ':' + candidate.childId + ':' + candidate.milestoneKey;
      if (!firstPerMilestone.has(key)) firstPerMilestone.set(key, candidate);
    }
    if (firstPerMilestone.size) await this.repo.ensureUnlocks([...firstPerMilestone.values()]);
    const persisted = await this.repo.listPersisted(actor.familyId, scope, childId);
    const confirmed = new Set(persisted.map((p) => p.sourceEventId + ':' + p.milestoneKey));
    const active = matching.filter((f) => confirmed.has(f.sourceEventId + ':' + f.milestoneKey));
    return active.length ? projectWorld(active, now) : emptyWorld(scope);
  }
}
