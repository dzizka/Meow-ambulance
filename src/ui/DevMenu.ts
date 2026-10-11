import type { GameState } from '../core/GameState';
import { SAVE_VERSION } from '../core/GameState';
import { button, el } from './dom';

/** Čo vývojárske menu potrebuje od scény a rozhrania. */
export interface DevHooks {
  /** Rýchlosť plynutia herného času (1 = normálne). */
  speed: number;
  setSpeed(speed: number): void;
  selectedCatId(): string | null;
  toast(msg: string): void;
  saveNow(): void;
  resetGame(): void;
  /** Spustí minihru na skúšku (výsledok sa nikam nezapíše). */
  playMinigame(
    kind: string,
    extra?: { xray?: 'fracture' | 'swallowed' | null; neuter?: boolean },
  ): void;
}

/** Všetky minihry na skúšku: [popis, druh, doplnky]. */
const MINIGAMES: [string, string, { xray?: 'fracture' | 'swallowed' | null; neuter?: boolean }?][] =
  [
    ['🕷️ Kliešte', 'tick_removal'],
    ['🩹 Obväz', 'bandage'],
    ['👂 Ušká', 'ears'],
    ['🥄 Sirup', 'syrup'],
    ['💨 Inhalácia', 'breath'],
    ['🛁 Kúpanie', 'bath'],
    ['✂️ Pazúriky', 'claws'],
    ['💧 Kvapky', 'drops'],
    ['💉 Očkovanie', 'vaccine'],
    ['🪶 Pierko', 'feather'],
    ['🤲 Držanie', 'hold'],
    ['🤫 Posedieť', 'quiet'],
    ['🩸 Krvný test', 'bloodtest'],
    ['🩻 Röntgen – zlomenina', 'xray', { xray: 'fracture' }],
    ['🩻 Röntgen – predmet', 'xray', { xray: 'swallowed' }],
    ['🩻 Röntgen – nič', 'xray', { xray: null }],
    ['🩺 Operácia', 'surgery'],
    ['🩺 Kastrácia', 'surgery', { neuter: true }],
    ['🦴 Dlaha', 'splint'],
    ['🌀 CT', 'ct'],
    ['🏊 Plávanie', 'swim'],
    ['🎓 Kvíz (prednáška)', 'quiz'],
  ];

const PHASE_HOUR = { ráno: 7, deň: 12, večer: 19, noc: 23 } as const;

/**
 * Tajné vývojárske menu na testovanie (TECH.md – Vývojárske menu).
 * Otvorenie: 5× rýchlo ťuknúť na hodiny, kláves ` alebo adresa s #dev.
 * Texty sú zámerne iba po slovensky a priamo v kóde – hráč toto menu nevidí.
 */
export class DevMenu {
  private readonly root = el('div', { class: 'dev', hidden: true, role: 'dialog' });
  private readonly box = el('div', { class: 'dev-box' });
  private taps: number[] = [];

  constructor(
    private readonly state: GameState,
    private readonly hooks: DevHooks,
  ) {
    this.root.append(this.box);
    // pointerdown, nie click – inak by ťuknutie, ktoré menu otvorilo, ho hneď zavrelo
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root) this.close();
    });
    document.body.append(this.root);
    window.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.key === ';') this.toggle();
      if (e.key === 'Escape') this.close();
    });
    if (/[#&]dev\b/.test(location.hash)) this.open();
  }

  /** Volá sa pri ťuknutí na hodiny – 5 ťuknutí za sebou (odstup do 1,5 s) menu otvorí. */
  secretTap(): void {
    const now = performance.now();
    const last = this.taps[this.taps.length - 1];
    this.taps = last !== undefined && now - last < 1500 ? [...this.taps, now] : [now];
    if (this.taps.length >= 5) {
      this.taps = [];
      this.open();
    }
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(): void {
    this.render();
    this.root.hidden = false;
  }

  close(): void {
    this.root.hidden = true;
  }

  private toggle(): void {
    if (this.root.hidden) this.open();
    else this.close();
  }

  private render(): void {
    const s = this.state;
    const h = this.hooks;
    const selected = h.selectedCatId();
    const selectedCat = selected ? s.getCat(selected) : undefined;
    /** Akcia, ktorá po vykonaní ukáže výsledok a prekreslí menu. */
    const act = (label: string, run: () => string | boolean | void, attrs = {}) =>
      button(
        label,
        () => {
          const r = run();
          if (typeof r === 'string') h.toast(`🛠 ${r}`);
          else if (r === false) h.toast('🛠 Teraz sa to nedá');
          this.render();
        },
        attrs,
      );
    const section = (title: string, ...buttons: HTMLElement[]) =>
      el('section', {}, el('h3', {}, title), el('div', { class: 'dev-row' }, ...buttons));

    const close = button('✕', () => this.close(), { class: 'close', 'aria-label': 'Zavrieť' });
    this.box.replaceChildren(
      el('div', { class: 'dev-head' }, el('h2', {}, '🛠 Vývojárske menu'), close),
      el(
        'p',
        { class: 'dev-info' },
        `save v${SAVE_VERSION} · ${s.clock} (${s.dayPhase}) · ${Math.floor(s.money)} € · ★ ${s.reputation} · ` +
          `mačky ${s.cats.length} · hlásenia ${s.reports.length} · záujemcovia ${s.adopters.length} · ` +
          `hostia ${s.cafe.guests.length} · rýchlosť ${h.speed}×`,
      ),
      section(
        '💰 Peniaze',
        act('+100 €', () => s.devGive(100)),
        act('+1000 €', () => s.devGive(1000)),
        act('+50 ★', () => s.devGive(0, 50)),
        act('+20 ❤', () => {
          s.hearts += 20;
          return `Srdiečka: ${s.hearts}`;
        }),
        act('Vybraná: vzácna', () => {
          const c = h.selectedCatId() ? s.getCat(h.selectedCatId() ?? '') : undefined;
          if (!c) return false;
          const marks = ['hetero', 'poly', 'tortie_male'] as const;
          c.special = marks[(marks.indexOf(c.special as (typeof marks)[number]) + 1) % 3];
          return `${c.name}: ${c.special}`;
        }),
      ),
      section(
        '📋 Prichádzajúci',
        act('Nové hlásenie', () => s.devSpawnReport() && 'Hlásenie pridané'),
        act('Záujemca', () => s.devSpawnAdopter() || 'Nikto nie je pripravený / plno'),
        act('Hosť v kaviarni', () => s.devSpawnGuest() || 'Treba kaviareň, stálicu a voľný stôl'),
        act('Hostia odídu', () => s.devGuestsLeave()),
      ),
      section(
        '🐈 Mačky',
        act(
          selectedCat ? `Vyliečiť: ${selectedCat.name}` : 'Vyliečiť vybranú',
          () => !!selected && s.devHeal(selected) && 'Vyliečená a pripravená',
          { disabled: !selectedCat },
        ),
        act('Vyliečiť všetky', () => {
          for (const c of s.cats) s.devHeal(c.id);
          return `Vyliečené: ${s.cats.length}`;
        }),
      ),
      section(
        '⏱ Čas',
        ...[1, 5, 20].map((n) =>
          act(`${n}×`, () => h.setSpeed(n), { class: n === h.speed ? 'btn primary' : 'btn' }),
        ),
        act('+1 h', () => s.devShiftClock(1)),
        act('+6 h', () => s.devShiftClock(6)),
        ...Object.entries(PHASE_HOUR).map(([name, hour]) =>
          act(name, () => {
            const diff = (hour * 60 - s.clockMinutes + 1440) % 1440;
            s.devShiftClock(diff / 60);
          }),
        ),
      ),
      section(
        '🌙 Offline (ako keby bola hra zatvorená)',
        ...[1, 8].map((hours) =>
          act(`${hours} h`, () => {
            const summary = s.applyOffline(hours * 3_600_000);
            s.bus.emit('welcomeBack', { summary });
            this.close();
          }),
        ),
      ),
      section(
        '🎯 Postup',
        act('Splniť výzvy', () => s.devCompleteChallenges()),
        act('Úspechy odznova', () => {
          s.achievements = {};
          return 'Úspechy vymazané (odomknú sa znova)';
        }),
        act('Pohľadnice teraz', () => `Doručené: ${s.devDeliverPostcards()}`),
        act('Kaviareň zadarmo', () => s.devOpenCafe() && 'Kaviareň otvorená'),
        act('Útulok zadarmo', () => s.devOpenShelter() && 'Útulok otvorený'),
        act('Udalosť: Zima', () => {
          s.devGive(0, Math.max(0, 25 - s.reputation));
          return s.devOfferEvent('winter') && 'Ponuka: Zima';
        }),
        act('Udalosť: Deň otvorených dverí', () => {
          s.devOpenCafe();
          s.devGive(0, Math.max(0, 25 - s.reputation));
          return s.devOfferEvent('openday') && 'Ponuka: Deň otvorených dverí';
        }),
        act('Udalosť: Množiareň', () => {
          s.devOpenShelter();
          return s.devOfferEvent('mill') && 'Ponuka: Množiareň';
        }),
        act('Ukončiť udalosť', () => s.devEndEvent() && 'Udalosť skončila'),
        act('Školský výlet', () => {
          if (!s.hasUnlock('education'))
            s.devGive(0, Math.max(0, (s.unlockRep('education') ?? 0) - s.reputation));
          return s.devSchoolTrip() ? 'Výlet prišiel' : 'Výlet už čaká';
        }),
        act('Hotel + hosť', () => {
          if (!s.hasUnlock('hotel'))
            s.devGive(0, Math.max(0, (s.unlockRep('hotel') ?? 0) - s.reputation));
          return s.devOpenHotel() ? 'Hosť prišiel' : 'Hotel je plný';
        }),
        act('Hotel: odchod hostí', () => s.devHotelCheckout()),
        act('Catio zadarmo', () => {
          if (!s.hasUnlock('catio'))
            s.devGive(0, Math.max(0, (s.unlockRep('catio') ?? 0) - s.reputation));
          return s.devOpenCatio() && 'Catio otvorené';
        }),
        act('2. poschodie zadarmo', () => {
          s.devGive(0, Math.max(0, (s.unlockRep('floors') ?? 0) - s.reputation));
          return s.devOpenFloor2() && 'Poschodie s CT a bazénom';
        }),
        act('Klinika zadarmo', () => {
          if (!s.hasUnlock('clinic'))
            s.devGive(0, Math.max(0, (s.unlockRep('clinic') ?? 0) - s.reputation));
          s.devOpenClinic();
          return 'Klinika so všetkými miestnosťami';
        }),
        act('Najať personál', () => {
          if (!s.hasUnlock('staff'))
            s.devGive(0, Math.max(0, (s.unlockRep('staff') ?? 0) - s.reputation));
          for (const d of s.data.staff) {
            s.devGive(d.price);
            s.hireStaff(d.id);
          }
          return 'Personál najatý';
        }),
        act('Tutoriál odznova', () => {
          s.tutorialStep = 0;
          s.tutorialDone = false;
        }),
      ),
      section(
        '🎮 Minihry (na skúšku, nič sa nezapíše)',
        ...MINIGAMES.map(([label, kind, extra]) =>
          button(label, () => {
            this.close();
            h.playMinigame(kind, extra);
          }),
        ),
      ),
      section(
        '💾 Uloženie',
        act('Uložiť teraz', () => {
          h.saveNow();
          return 'Uložené';
        }),
        act('Nová hra', () => h.resetGame()),
      ),
    );
  }
}
