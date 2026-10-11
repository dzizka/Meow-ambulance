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
}

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
        act('Pohľadnice teraz', () => `Doručené: ${s.devDeliverPostcards()}`),
        act('Kaviareň zadarmo', () => s.devOpenCafe() && 'Kaviareň otvorená'),
        act('Útulok zadarmo', () => s.devOpenShelter() && 'Útulok otvorený'),
        act('Tutoriál odznova', () => {
          s.tutorialStep = 0;
          s.tutorialDone = false;
        }),
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
