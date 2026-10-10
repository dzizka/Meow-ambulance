/**
 * Deterministický generátor náhodných čísel (mulberry32).
 * Rovnaký seed = rovnaké mačky → testovateľné a ukladateľné.
 */
export class Rng {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed >>> 0;
  }

  /** Vnútorný stav – ukladá sa do savu, aby náhoda pokračovala rovnako. */
  getState(): number {
    return this.state;
  }

  /** Číslo v intervale [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Celé číslo v intervale [min, max] vrátane. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: prázdny zoznam');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Výber podľa váh (vyššia váha = častejšie). */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    const total = items.reduce((sum, item) => sum + weight(item), 0);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= weight(item);
      if (roll < 0) return item;
    }
    return items[items.length - 1] as T;
  }

  /** `count` rôznych prvkov v náhodnom poradí. */
  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    while (out.length < count && pool.length > 0) {
      out.push(pool.splice(Math.floor(this.next() * pool.length), 1)[0] as T);
    }
    return out;
  }
}
