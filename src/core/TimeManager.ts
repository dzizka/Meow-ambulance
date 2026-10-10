import type { EventBus } from './EventBus';

export type GameSpeed = 0 | 1 | 2 | 3;

/**
 * Herný čas (GDD §2.2): deň beží od start_hour do end_hour,
 * jedna herná hodina = real_seconds_per_game_hour sekúnd pri rýchlosti 1×.
 */
export class TimeManager {
  day = 1;
  /** Minúty od polnoci. */
  minutes: number;
  speed: GameSpeed = 1;

  constructor(
    private bus: EventBus,
    private startHour: number,
    private endHour: number,
    private secondsPerHour: number,
  ) {
    this.minutes = startHour * 60;
  }

  get hour(): number {
    return Math.floor(this.minutes / 60);
  }

  get isDayOver(): boolean {
    return this.minutes >= this.endHour * 60;
  }

  /** Formát hodín pre HUD, napr. "07:30". */
  get clock(): string {
    const h = String(this.hour).padStart(2, '0');
    const m = String(Math.floor(this.minutes % 60)).padStart(2, '0');
    return `${h}:${m}`;
  }

  setSpeed(speed: GameSpeed): void {
    this.speed = speed;
  }

  /** Posunie čas o `deltaMs` reálnych milisekúnd. */
  update(deltaMs: number): void {
    if (this.speed === 0 || this.isDayOver) return;
    const before = this.hour;
    const gameMinutes = (deltaMs / 1000 / this.secondsPerHour) * 60 * this.speed;
    this.minutes = Math.min(this.minutes + gameMinutes, this.endHour * 60);
    if (this.hour !== before) this.bus.emit('hourChanged', { day: this.day, hour: this.hour });
    if (this.isDayOver) this.bus.emit('dayEnded', { day: this.day });
  }

  startNextDay(): void {
    this.day += 1;
    this.minutes = this.startHour * 60;
    this.bus.emit('dayStarted', { day: this.day });
  }
}
