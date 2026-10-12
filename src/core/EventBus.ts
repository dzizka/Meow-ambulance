import type { SchoolTrip } from './GameState';
import type {
  ActiveChallenge,
  AdopterVisit,
  AdoptionRecord,
  CafeGuest,
  CafeReview,
  CatData,
  DecorDef,
  LevelDef,
  Report,
  StaffId,
  WishDef,
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
  /** `returned` = mačka sa vrátila po slabej adopcii (GDD §5.2). */
  catAdmitted: { cat: CatData; returned?: boolean };
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
  upgradeBought: {
    kind:
      | 'cage'
      | 'slot'
      | 'cafe'
      | 'table'
      | 'shelter'
      | 'clinic'
      | 'catio'
      | 'hotel'
      | 'suite'
      | 'floor'
      | 'education';
  };
  /** Srdiečka a kozmetika (GDD §7.6). */
  heartsChanged: { hearts: number; delta: number };
  wallChanged: { room: 'garage' | 'cafe'; id: string | null };
  /** Udalosti (GDD §7.3). */
  eventOffered: { def: import('../data/types').EventDef };
  eventStarted: { def: import('../data/types').EventDef };
  eventEnded: { def: import('../data/types').EventDef; bonus: boolean; money: number; rep: number };
  /** Úspech odomknutý (GDD §7.5). */
  achievementUnlocked: { def: import('../data/types').AchievementDef };
  /** Edukačné centrum (GDD §6.9). */
  tripArrived: { trip: SchoolTrip };
  tripLeft: { trip: SchoolTrip; stars: number; money: number; rep: number };
  /** Mačací hotel (GDD §6.7). */
  hotelCheckIn: { cat: CatData };
  hotelCheckOut: { cat: CatData; fee: number; happy: number; rep: number };
  clinicRoomBought: { room: import('../data/types').ClinicRoomId };
  /** Mačka je na klinike pri prístroji (vyšetrenie, operácia) – iba pre zobrazenie. */
  clinicVisit: { cat: CatData; room: import('../data/types').ClinicRoomId; recover: boolean };
  catMoved: { cat: CatData };
  staffHired: { id: StaffId };
  /** Personál niečo urobil (pre postavičky a oznámenia). */
  staffAction: {
    id: StaffId;
    kind: 'feed' | 'brush' | 'examine' | 'serve';
    cat?: CatData;
    found?: string[];
  };
  guestArrived: { guest: CafeGuest };
  guestServed: { guest: CafeGuest };
  campaignStarted: { district: number };
  campaignPrestige: { prestige: number; gained: number };
  adoptionDay: { active: boolean };
  wishAppeared: { cat: CatData };
  wishGranted: { cat: CatData; def: WishDef };
  campaignDone: { district: number; cleared: boolean };
  guestLeft: { guest: CafeGuest; amount: number; review: CafeReview };
  levelUp: { level: number; def: LevelDef };
  equipmentBought: { id: string; level: number };
  decorBought: { def: DecorDef };
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
