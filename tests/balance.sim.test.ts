/**
 * Simulácia „rozumného hráča" na kontrolu balansu (GDD §13): bot hrá aktívne (každých 5 s
 * urobí, čo sa dá) a meria, kedy dosiahne úrovne a postaví budovy.
 * Spúšťa sa iba na požiadanie: SIM=1 npx vitest run tests/balance.sim.test.ts
 */
import { describe, expect, it } from 'vitest';
import { GameState } from '../src/core/GameState';
import type { ClinicRoomId, DiagnosticTool, SocialActivity, StaffId } from '../src/data/types';
import { loadTestData } from './loadData';

const data = loadTestData();
const STEP = 5_000;
const ACTIVITIES: SocialActivity[] = ['feather', 'brush', 'hand_feed', 'sit_quietly'];

interface SimLog {
  levels: number[]; // minúty, kedy bola dosiahnutá úroveň i
  built: Record<string, number>;
  income: Record<string, number>;
  adoptions: number;
  rep: number;
  money: number;
}

export function simulate(hours: number, seed = 1, stars: 1 | 2 | 3 = 2): SimLog {
  const s = new GameState(data, seed);
  s.dismissTutorial();
  const log: SimLog = { levels: [0], built: {}, income: {}, adoptions: 0, rep: 0, money: 0 };
  const add = (k: string, v: number) => (log.income[k] = (log.income[k] ?? 0) + v);
  s.bus.on('levelUp', ({ level }) => (log.levels[level] = Math.round(s.now / 60_000)));
  s.bus.on('catAdopted', ({ record }) => {
    log.adoptions += 1;
    add('adopcie', record.fee);
  });
  s.bus.on('guestLeft', ({ amount }) => add('kaviareň (hostia)', amount));
  s.bus.on('hotelCheckOut', ({ fee }) => add('hotel', fee));
  s.bus.on('tripLeft', ({ money }) => add('výlety', money));
  const mark = (k: string) => (log.built[k] ??= Math.round(s.now / 60_000));
  const buy = (k: string, ok: boolean) => ok && mark(k);

  for (let t = 0; t < hours * 3_600_000; t += STEP) {
    const before = s.money;
    s.tick(STEP);
    // priebežné dary stálic (rozdiel mínus udalosti sa počíta približne)
    add('dary stálic', Math.max(0, s.donationsPerMinute * (STEP / 60_000)));
    void before;

    // hlásenia
    for (const r of [...s.reports]) if (s.freeCages >= s.cagesNeeded(r.id)) s.acceptReport(r.id);
    // starostlivosť
    for (const cat of [...s.cats, ...s.hotel.guests]) {
      if (!cat.resident && !cat.hotel) {
        for (const tool of s.tools as DiagnosticTool[])
          if (!cat.examined.includes(tool)) s.examine(cat.id, tool);
        for (const c of cat.conditions) if (c.revealed && !c.treated) s.treat(cat.id, c.id, stars);
        s.vaccinate(cat.id);
        if (s.canNeuter(cat)) s.neuter(cat.id);
        if (s.canRehab(cat)) s.rehab(cat.id);
      }
      if (s.feedCooldownLeft(cat.id) === 0 && cat.stats.satisfaction < 70) s.feed(cat.id);
      if (s.socialCooldownLeft(cat.id) === 0)
        s.socialize(cat.id, ACTIVITIES[Math.floor(Math.random() * 4)]!, stars);
    }
    // adopcie: najlepší záujemca; inak nechať si stálicu
    for (const cat of s.cats.filter((c) => s.isReady(c) && !c.resident)) {
      const best = s.adopters
        .map((v) => ({ v, m: s.matchFor(cat.id, v.id, false) }))
        .filter((x) => x.m && x.m.quality !== 'blocked')
        .sort((a, b) => (b.m?.score ?? 0) - (a.m?.score ?? 0))[0];
      if (best) s.adopt(cat.id, best.v.id);
      else if (s.freeResidentSlots > 0) s.makeResident(cat.id);
    }
    // kaviareň – hráč obsluhuje väčšinu hostí
    for (const g of s.waitingGuests) if (Math.random() < 0.7) s.serveGuest(g.id);
    if (s.education.trip) s.giveLecture(stars);
    for (const ch of s.challenges.filter((c) => c.completed)) s.claimChallenge(ch.defId);

    // nákupy v poradí, ako by ich asi robil hráč
    buy('kaviareň', s.buyCafe());
    if (s.nextCagePrice !== null && s.money > s.nextCagePrice + 50) buy('klietka', s.buyCage());
    buy('útulok', s.buyShelter());
    for (const id of ['vet', 'caretaker', 'social', 'barista'] as StaffId[])
      buy(`personál ${id}`, s.hireStaff(id));
    buy('klinika', s.buyClinic());
    for (const r of ['lab', 'xray', 'or', 'ct', 'pool'] as ClinicRoomId[])
      buy(`klinika ${r}`, s.buyClinicRoom(r));
    buy('catio', s.buyCatio());
    buy('hotel', s.buyHotel());
    if (s.nextSuitePrice !== null && s.money > s.nextSuitePrice + 500) s.buySuite();
    buy('2. poschodie', s.buyFloor());
    buy('edukácia', s.buyEducation());
    // šetrí na odomknutú budovu, ktorú ešte nemá
    const saving =
      (s.hasUnlock('shelter_2') && !s.shelter.open) ||
      (s.hasUnlock('clinic') && !s.clinic.open) ||
      (s.hasUnlock('catio') && !s.catio.open) ||
      (s.hasUnlock('hotel') && !s.hotel.open) ||
      (s.hasUnlock('education') && !s.education.open);
    if (!saving && s.money > 600) {
      for (const e of data.equipment) s.buyEquipment(e.id);
      if (s.nextTablePrice !== null) s.buyTable();
      if (s.nextSlotPrice !== null) s.buySlot();
    }
  }
  log.rep = s.reputation;
  log.money = Math.round(s.money);
  return log;
}

describe.skipIf(!process.env.SIM)('Simulácia balansu', () => {
  it('aktívny hráč – časy úrovní a stavieb (minúty)', () => {
    const hours = Number(process.env.SIM_HOURS ?? 8);
    for (const seed of [1, 2, 3]) {
      const log = simulate(hours, seed);
      console.log(`\n=== seed ${seed}: ${hours} h ===`);
      console.log('úrovne (min):', log.levels.join(' | '));
      console.log('stavby (min):', JSON.stringify(log.built));
      console.log(
        'príjmy (€):',
        Object.entries(log.income)
          .map(([k, v]) => `${k} ${Math.round(v)}`)
          .join(', '),
      );
      console.log(`adopcie ${log.adoptions}, ★ ${log.rep}, peniaze ${log.money}`);
    }
    expect(true).toBe(true);
  }, 600_000);
});
