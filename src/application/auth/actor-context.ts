export type ActorKind = 'guardian' | 'child' | 'system';

export interface ActorContext {
  actorKind: ActorKind;
  actorId: string;
  familyId: string;
  childId?: string;
}

// E0 defines the trusted server-side shape only.
// Credential resolution and authorization behavior are implemented in E1.
