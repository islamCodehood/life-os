import type { ActorContext } from './actor-context';

export interface ActorResolver {
  resolve(request: Request): Promise<ActorContext | null>;
}
