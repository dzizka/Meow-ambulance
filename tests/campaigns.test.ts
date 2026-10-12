import { describe, expect, it } from 'vitest';
import { GameState, type SaveData } from '../src/core/GameState';
import { SaveManager, type SaveStorage } from '../src/core/SaveManager';
import { loadTestData } from './loadData';

const data = loadTestData();
const c = data.balance.campaigns;

function storage(): SaveStorage {
  const mem = new Map<string, string>();
  return {
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => void mem.set(k, v),
    remove: (k) => void mem.delete(k),
  };
}

function withClinic(): GameState {
  const s = new GameState(data, 21);
  s.devOpenClinic();
  s.money = 10_000_000;
  return s;
}

describe('Kastračné kampane (GDD §7.7)', () => {
  it('potrebujú kliniku; jedna naraz; po čase dajú ★ a ❤', () => {
    const s = new GameState(data, 1);
    s.money = 100_000;
    expect(s.startCampaign()).toBe(false);
    s.devOpenClinic();
    const money = s.money;
    const price = s.campaignPrice;
    expect(s.startCampaign()).toBe(true);
    expect(s.money).toBe(money - price);
    expect(s.startCampaign()).toBe(false); // už beží
    const rep = s.reputation;
    const hearts = s.hearts;
    s.tick(s.campaignDurationMs + 1000);
    expect(s.campaigns.done).toBe(1);
    expect(s.campaigns.active).toBeNull();
    expect(s.reputation).toBeGreaterThanOrEqual(rep + c.rep);
    expect(s.hearts).toBeGreaterThanOrEqual(hearts + c.hearts);
  });

  it('cena rastie bez konca, obvod sa vyčistí po per_district kampaniach', () => {
    const s = withClinic();
    let last = 0;
    let cleared = 0;
    s.bus.on('campaignDone', (e) => (cleared += e.cleared ? 1 : 0));
    for (let i = 0; i < c.per_district * 4; i++) {
      expect(s.campaignPrice).toBeGreaterThan(last);
      last = s.campaignPrice;
      expect(s.startCampaign()).toBe(true);
      s.tick(s.campaignDurationMs + 1000);
    }
    expect(cleared).toBe(4);
    expect(s.campaignDistrict).toBe(4);
    expect(s.campaignAdopterBonus).toBeCloseTo(4 * c.adopter_bonus_per_district);
    // bonus má strop
    s.campaigns.done = 10_000;
    expect(s.campaignAdopterBonus).toBe(c.adopter_bonus_max);
    expect(Number.isFinite(s.campaignPrice)).toBe(true);
  });

  it('kampaň dobehne aj počas offline; save v16 a migrácia z v15', () => {
    const st = storage();
    const saves = new SaveManager(st, 'k', () => 1000);
    const s = withClinic();
    s.startCampaign();
    s.applyOffline(s.campaignDurationMs + 5000);
    expect(s.campaigns.done).toBe(1);
    s.startCampaign();
    saves.save(s);
    const loaded = saves.load(data)!.state;
    expect(loaded.campaigns.done).toBe(1);
    expect(loaded.campaigns.active).not.toBeNull();
    const old = JSON.parse(st.get('k')!) as Partial<SaveData>;
    delete old.campaigns;
    old.version = 15;
    st.set('k', JSON.stringify(old));
    expect(saves.load(data)!.state.campaigns).toEqual({ done: 0, active: null });
  });
});
