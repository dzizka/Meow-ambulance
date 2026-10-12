import { describe, expect, it } from 'vitest';
import { GameState } from '../src/core/GameState';
import { levelRep, loadTestData } from './loadData';

const data = loadTestData();
const cos = data.cosmetics!;
const camp = data.balance.campaigns;

function withResident(seed = 5): { s: GameState; id: string } {
  const s = new GameState(data, seed);
  s.devGive(5000, levelRep(2));
  s.devSpawnReport();
  const cat = s.acceptReport(s.reports[0]!.id)!;
  s.devHeal(cat.id);
  s.makeResident(cat.id);
  return { s, id: cat.id };
}

describe('Deň adopcií (GDD §7.8)', () => {
  it('stojí ❤, potrebuje pripravenú mačku, privedie viac záujemcov, potom prestávka', () => {
    const s = new GameState(data, 2);
    s.hearts = 100;
    expect(s.startAdoptionDay()).toBe(false); // nikto nie je pripravený
    s.devSpawnReport();
    const cat = s.acceptReport(s.reports[0]!.id)!;
    s.devHeal(cat.id);
    s.tick(1000);
    const hearts = s.hearts;
    expect(s.startAdoptionDay()).toBe(true);
    expect(s.hearts).toBe(hearts - cos.adoption_day.price);
    expect(s.adoptionDayActive).toBe(true);
    s.tick(1000);
    expect(s.adopters.length).toBeGreaterThan(0); // prvý záujemca hneď
    expect(s.startAdoptionDay()).toBe(false);
    s.tick(cos.adoption_day.duration_s * 1000);
    expect(s.adoptionDayActive).toBe(false);
    expect(s.adoptionDayCooldown).toBeGreaterThan(0);
    s.tick(cos.adoption_day.cooldown_s * 1000);
    expect(s.adoptionDayCooldown).toBe(0);
  });
});

describe('Želania stálic (GDD §7.8)', () => {
  it('stálica si zaželá, splnenie stojí ❤ a prehĺbi puto (vyššie dary)', () => {
    const { s, id } = withResident();
    const cat = s.getCat(id)!;
    for (let i = 0; i < 40 && !cat.wish; i++) s.tick(30_000);
    expect(cat.wish).toBeTruthy();
    const price = s.wishPrice(cat);
    s.hearts = price - 1;
    expect(s.grantWish(id)).toBe(false);
    s.hearts = 100;
    cat.stats.satisfaction = 50;
    const donations = s.donationsPerMinute;
    expect(s.grantWish(id)).toBe(true);
    expect(s.hearts).toBe(100 - price);
    expect(cat.bond).toBe(1);
    expect(cat.wish).toBeNull();
    cat.stats.satisfaction = 50;
    expect(s.donationsPerMinute).toBeGreaterThan(donations);
    // ďalšie želanie stojí o puto viac
    for (let i = 0; i < 40 && !cat.wish; i++) s.tick(30_000);
    expect(s.wishPrice(cat)).toBe(s.wishDef(cat.wish)!.price + 1);
  });
});

describe('Prestíž kampaní (GDD §7.7)', () => {
  it('po hotovej úrovni sa dá začať odznova: lacné kampane, 🏅 bonusy, bonus obvodov ostáva', () => {
    const s = new GameState(data, 9);
    s.devOpenClinic();
    s.money = 1e9;
    expect(s.prestigeCampaigns()).toBe(0);
    const perTier = camp.per_district * camp.districts_per_tier;
    s.campaigns.done = perTier; // celé mesto hotové
    const bonus = s.campaignAdopterBonus;
    const expensive = s.campaignPrice;
    expect(s.prestigeCampaigns()).toBe(1);
    expect(s.campaigns.done).toBe(0);
    expect(s.campaignPrestige).toBe(1);
    expect(s.campaignPrice).toBeLessThan(expensive);
    expect(s.campaignPrice).toBeGreaterThan(camp.base_price); // o kúsok drahšie ako prvýkrát
    expect(s.campaignAdopterBonus).toBe(bonus);
    expect(s.prestigeFeeMult).toBeCloseTo(1 + camp.prestige_fee);
    // odmena kampane je vyššia
    const rep = s.reputation;
    s.startCampaign();
    s.tick(s.campaignDurationMs + 1000);
    expect(s.reputation - rep).toBeGreaterThanOrEqual(
      Math.round(camp.rep * (1 + camp.prestige_reward)),
    );
  });
});
