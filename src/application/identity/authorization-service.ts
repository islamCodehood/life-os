import type { ActorContext } from '@/src/application/auth/actor-context';
import type { ChildId } from '@/src/domain/shared/id';
import type { IdentityRepository } from './identity-repository';

export class AuthorizationService {
  constructor(private readonly repository: IdentityRepository) {}

  async canViewChild(actor: ActorContext, childId: ChildId): Promise<boolean> {
    if (actor.kind === 'SYSTEM') return false;

    if (actor.kind === 'CHILD') {
      return actor.childId === childId;
    }

    return (await this.repository.getChild(actor.familyId, childId)) !== null;
  }

  canAccessParent(actor: ActorContext): boolean {
    return actor.kind === 'GUARDIAN';
  }

  canAccessChild(actor: ActorContext, childId?: ChildId): boolean {
    return actor.kind === 'CHILD' && (childId === undefined || actor.childId === childId);
  }
}
