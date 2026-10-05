import { DexieOfflineCommandStore } from '@/src/offline/db/dexie-offline-command-store';
import type { OfflineActorScope } from '@/src/offline/model';
import { HttpCommandTransport } from '@/src/offline/sync/http-command-transport';
import { SyncCoordinator } from '@/src/offline/sync/sync-coordinator';

interface ActiveActor {
  scope: OfflineActorScope;
  controller: AbortController;
  retryTimer?: number;
}

export class BrowserOfflineRuntime {
  readonly store = new DexieOfflineCommandStore();
  readonly coordinator = new SyncCoordinator(this.store, new HttpCommandTransport());

  private readonly activeActors = new Map<string, ActiveActor>();

  activateActor(scope: OfflineActorScope): () => void {
    for (const actorKey of this.activeActors.keys()) {
      if (actorKey !== scope.actorKey) this.deactivateActor(actorKey);
    }

    if (!this.activeActors.has(scope.actorKey)) {
      this.activeActors.set(scope.actorKey, {
        scope,
        controller: new AbortController(),
      });
    }

    void this.signalSync(scope);
    return () => this.deactivateActor(scope.actorKey);
  }

  deactivateActor(actorKey: string): void {
    const active = this.activeActors.get(actorKey);
    if (!active) return;

    active.controller.abort();
    if (active.retryTimer !== undefined) window.clearTimeout(active.retryTimer);
    this.activeActors.delete(actorKey);
  }

  scheduleSync(scope: OfflineActorScope): void {
    if (typeof window === 'undefined') return;
    window.setTimeout(() => void this.signalSync(scope), 0);
  }

  async signalSync(scope: OfflineActorScope): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.onLine) return;

    const active = this.activeActors.get(scope.actorKey);
    if (!active) return;

    const result = await this.coordinator.sync(scope, active.controller.signal);
    const current = this.activeActors.get(scope.actorKey);
    if (!current || current.controller.signal.aborted) return;

    if (result.outcome === 'RETRYABLE' && navigator.onLine) {
      if (current.retryTimer !== undefined) window.clearTimeout(current.retryTimer);
      current.retryTimer = window.setTimeout(() => {
        const latest = this.activeActors.get(scope.actorKey);
        if (latest) {
          latest.retryTimer = undefined;
          void this.signalSync(scope);
        }
      }, 5_000);
    }
  }
}

let runtime: BrowserOfflineRuntime | null = null;

export function getBrowserOfflineRuntime(): BrowserOfflineRuntime {
  if (typeof window === 'undefined') {
    throw new Error('Browser offline runtime is only available in the client.');
  }

  runtime ??= new BrowserOfflineRuntime();
  return runtime;
}
