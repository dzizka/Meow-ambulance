import type { CatData, GameData } from '../data/types';
import { EventBus } from './EventBus';
import { Rng } from './Rng';
import { TimeManager } from './TimeManager';
import { generateCat } from './systems/CatGenerator';

/** Celý stav jednej hry. Phaser scény ho iba čítajú a volajú jeho akcie. */
export class GameState {
  readonly bus = new EventBus();
  readonly time: TimeManager;
  readonly rng: Rng;
  money: number;
  reputation = 0;
  cats: CatData[] = [];

  constructor(
    readonly data: GameData,
    seed?: number,
  ) {
    const b = data.balance;
    this.rng = new Rng(seed);
    this.money = b.phase_1.starting_money;
    this.time = new TimeManager(
      this.bus,
      b.day.start_hour,
      b.day.end_hour,
      b.day.real_seconds_per_game_hour,
    );
  }

  get cageCount(): number {
    return this.data.balance.phase_1.cages;
  }

  get hasFreeCage(): boolean {
    return this.cats.length < this.cageCount;
  }

  /** Prijme novú mačku do útulku, ak je voľná klietka. */
  admitCat(): CatData | null {
    if (!this.hasFreeCage) return null;
    const cat = generateCat(this.data, this.rng, this.time.day);
    this.cats.push(cat);
    this.bus.emit('catAdmitted', { cat });
    return cat;
  }

  getCat(id: string): CatData | undefined {
    return this.cats.find((c) => c.id === id);
  }
}
