import type { CatData } from '../data/types';

/** Všetky globálne udalosti hry a ich dáta (GDD §10.2). */
export interface GameEvents {
  catAdmitted: { cat: CatData };
  catSelected: { catId: string | null };
  hourChanged: { day: number; hour: number };
  dayStarted: { day: number };
  dayEnded: { day: number };
  moneyChanged: { money: number };
}

type Handler<T> = (payload: T) => void;

/** Malý typovaný event bus bez závislosti na Phaseri. */
export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<never>>>();

  on<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  off<K extends keyof GameEvents>(event: K, handler: Handler<GameEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    this.handlers.get(event)?.forEach((h) => (h as Handler<GameEvents[K]>)(payload));
  }
}
