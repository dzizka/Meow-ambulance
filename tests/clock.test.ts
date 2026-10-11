import { describe, expect, it } from 'vitest';
import { GameState } from '../src/core/GameState';
import { loadTestData } from './loadData';

const data = loadTestData();
const c = data.balance.clock;

describe('Hodiny – rýchlejšia noc (GDD §2.2)', () => {
  it('deň plynie normálne, noc 3× rýchlejšie', () => {
    const s = new GameState(data, 1);
    expect(s.clock).toBe('08:00');
    s.tick(c.real_seconds_per_game_hour * 1000 * 2); // 2 hodiny dňa
    expect(s.clock).toBe('10:00');
    s.devShiftClock(12); // 22:00
    expect(s.clock).toBe('22:00');
    expect(s.dayPhase).toBe('night');
    // celá noc (8 h) trvá 8 × night_seconds_per_game_hour
    s.tick(c.night_seconds_per_game_hour * 1000 * 8 - 1000);
    expect(s.dayPhase).toBe('night');
    s.tick(1000);
    expect(s.dayPhase).toBe('morning');
    expect(s.clock).toBe('06:00');
  });

  it('kaviareň je v noci zatvorená – noví hostia neprídu, ráno znova áno', () => {
    const s = new GameState(data, 2);
    s.tick(data.balance.rescue.interval_s * 1000);
    const cat = s.acceptReport(s.reports[0]!.id)!;
    s.devHeal(cat.id);
    s.makeResident(cat.id);
    s.devOpenCafe();
    // presuň sa na 22:00 a nechaj prejsť skoro celú noc
    const toNight = (22 * 60 - s.clockMinutes) / 60;
    s.devShiftClock(toNight);
    expect(s.cafeOpenNow).toBe(false);
    s.devGuestsLeave();
    for (let i = 0; i < 15; i++) s.tick(10_000);
    expect(s.dayPhase).toBe('night');
    expect(s.cafe.guests).toHaveLength(0);
    s.tick(60_000); // ráno
    expect(s.cafeOpenNow).toBe(true);
    s.tick(data.balance.cafe.guest_interval_s * 1000);
    expect(s.cafe.guests.length).toBeGreaterThan(0);
  });
});
