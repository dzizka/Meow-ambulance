import type {
  ActiveChallenge,
  AdopterVisit,
  AdoptionRecord,
  CafeGuest,
  CatData,
  Report,
} from '../data/types';

/** Súhrn toho, čo sa udialo, kým bola hra zatvorená (GDD §2.3). */
export interface OfflineSummary {
  minutes: number;
  reports: number;
  donations: number;
  postcards: number;
}

/** Všetky globálne udalosti hry a ich dáta (GDD §10.2). */
export interface GameEvents {
  catAdmitted: { cat: CatData };
  catChanged: { cat: CatData };
  catSelected: { catId: string | null };
  catAdopted: { record: AdoptionRecord };
  catBecameResident: { cat: CatData };
  catBecameReady: { cat: CatData };
  reportAdded: { report: Report };
  reportDeclined: { report: Report };
  adopterArrived: { visit: AdopterVisit };
  adopterLeft: { visit: AdopterVisit };
  postcardArrived: { record: AdoptionRecord };
  moneyChanged: { money: number; delta: number };
  reputationChanged: { reputation: number };
  welcomeBack: { summary: OfflineSummary };
  challengeCompleted: { challenge: ActiveChallenge };
  albumAdded: { key: string };
  upgradeBought: { kind: 'cage' | 'slot' | 'cafe' | 'table' };
  guestArrived: { guest: CafeGuest };
  guestServed: { guest: CafeGuest };
  guestLeft: { guest: CafeGuest; amount: number };
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
