import { describe, expect, it } from 'vitest';
import type { ActorContext } from '@/src/application/auth/actor-context';
import { AuthorizationService } from '@/src/application/identity/authorization-service';
import type { ChildId, DeviceId, FamilyId } from '@/src/domain/shared/id';
import { InMemoryIdentityRepository } from '../support/in-memory-identity-repository';

describe('sibling isolation', () => {
  it('lets a child view only their own private child scope', async () => {
    const repository = new InMemoryIdentityRepository();
    const authorization = new AuthorizationService(repository);
    const familyId = '01900000-0000-7000-8000-000000000030' as FamilyId;
    const ownId = '01900000-0000-7000-8000-000000000031' as ChildId;
    const siblingId = '01900000-0000-7000-8000-000000000032' as ChildId;
    const actor: ActorContext = {
      kind: 'CHILD',
      familyId,
      childId: ownId,
      deviceId: '01900000-0000-7000-8000-000000000033' as DeviceId,
    };

    await expect(authorization.canViewChild(actor, ownId)).resolves.toBe(true);
    await expect(authorization.canViewChild(actor, siblingId)).resolves.toBe(false);
    expect(authorization.canAccessParent(actor)).toBe(false);
  });
});
