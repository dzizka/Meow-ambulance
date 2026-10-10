import './ui.css';
import { catSheetPath, personSheetPath } from '../assets';
import { GameState } from '../core/GameState';
import type { Stars } from '../core/systems/Care';
import type { MatchResult } from '../core/systems/Match';
import type {
  AdoptionRecord,
  CatData,
  CatStats,
  DiagnosticTool,
  SocialActivity,
} from '../data/types';
import { t } from '../i18n/t';
import { button, el } from './dom';
import { DevMenu } from './DevMenu';
import { computeLayout, type Room } from '../scenes/layout';

/** Čo rozhranie potrebuje od hernej scény. */
export interface GameBridge {
  select(catId: string | null): void;
  runMinigame(req: MinigameRequest): Promise<Stars | null>;
  /** Ak zvuk `key` nie je k dispozícii (voliteľné zvuky), zahrá sa `fallback`. */
  playSound(key: string, volume?: number, fallback?: string): void;
  setMuted(muted: boolean): void;
  /** Zmaže uloženú hru a začne odznova. */
  resetGame(): void;
  /** Miestnosť, ktorú vidí kamera, a prepnutie do inej (GDD §5.5). */
  readonly room: Room;
  showRoom(room: Room): void;
  /** Vývojárske menu: rýchlosť času a okamžité uloženie. */
  readonly speed: number;
  setSpeed(speed: number): void;
  saveNow(): void;
}

export type MinigameKind =
  'tick_removal' | 'bandage' | 'ears' | 'syrup' | 'breath' | 'feather' | 'hold' | 'quiet';
export interface MinigameRequest {
  kind: MinigameKind;
  cat: CatData;
  title: string;
}

/** Druh minihry podľa ošetrenia alebo aktivity (GDD §4.2, §4.3). */
const TREATMENT_GAMES: Record<string, { kind: MinigameKind; titleKey: string }> = {
  tick_removal: { kind: 'tick_removal', titleKey: 'MG_TICK_TITLE' },
  bandage: { kind: 'bandage', titleKey: 'HOLD_BANDAGE' },
  ear_cleaning: { kind: 'ears', titleKey: 'HOLD_EAR' },
  syrup: { kind: 'syrup', titleKey: 'HOLD_SYRUP' },
  hold_brush: { kind: 'hold', titleKey: 'HOLD_BRUSH' },
  inhalation: { kind: 'breath', titleKey: 'MG_BREATH_TITLE' },
};
const SOCIAL: {
  id: SocialActivity;
  icon: string;
  key: string;
  kind: MinigameKind;
  title: string;
}[] = [
  { id: 'feather', icon: '🪶', key: 'ACT_FEATHER', kind: 'feather', title: 'MG_FEATHER_TITLE' },
  { id: 'brush', icon: '🪮', key: 'ACT_BRUSH', kind: 'hold', title: 'HOLD_BRUSH' },
  { id: 'hand_feed', icon: '🐟', key: 'ACT_HAND_FEED', kind: 'hold', title: 'HOLD_TREAT' },
  {
    id: 'sit_quietly',
    icon: '🤫',
    key: 'ACT_SIT_QUIETLY',
    kind: 'quiet',
    title: 'ACT_SIT_QUIETLY',
  },
];

const STAT_COLORS: Record<keyof CatStats, string> = {
  health: 'var(--ui-bad)',
  cleanliness: 'var(--ui-info)',
  trust: 'var(--ui-warn)',
  satisfaction: 'var(--ui-good)',
};
const STAT_KEYS: Record<keyof CatStats, string> = {
  health: 'STAT_HEALTH',
  cleanliness: 'STAT_CLEANLINESS',
  trust: 'STAT_TRUST',
  satisfaction: 'STAT_SATISFACTION',
};

type CardTab = 'health' | 'care' | 'about';
type MenuTab = 'challenges' | 'album' | 'postcards' | 'garage';

/** Portrét mačky: snímka „sedí, pozerá na hráča" (riadok 1, stĺpec 0) z hárka 768×512. */
function catPortrait(cat: CatData, scale = 3): HTMLElement {
  const s = scale;
  const node = el('div', {
    class: 'sprite',
    style: `width:${32 * s}px;height:${32 * s}px;background-image:url(${catSheetPath(cat.sprite)});background-size:${768 * s}px ${512 * s}px;background-position:0 ${-32 * s}px`,
    role: 'img',
    'aria-label': cat.name,
  });
  if (cat.stats.cleanliness < 30) node.style.filter = 'sepia(0.5) brightness(0.8)';
  return node;
}

/** Portrét človeka: idle snímka dole (stĺpec 1, riadok 0) z hárka 64×128. */
function personPortrait(sprite: string, scale = 3): HTMLElement {
  const s = scale;
  return el('div', {
    class: 'sprite',
    style: `width:${20 * s}px;height:${32 * s}px;background-image:url(${personSheetPath(sprite)});background-size:${64 * s}px ${128 * s}px;background-position:${-20 * s}px 0`,
  });
}

const paws = (n: number): string => '🐾'.repeat(n);
const ORDER_ICON = { coffee: '☕', tea: '🍵', cake: '🍰' } as const;
const round1 = (n: number): string =>
  (Math.round(n * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 });

/**
 * HTML rozhranie nad plátnom: horný panel, karta mačky, hlásenia, záujemcovia,
 * pohľadnice, oznámenia. Stav číta z GameState, akcie posiela späť cez GameState a GameBridge.
 */
export class UI {
  private root = el('div', { id: 'ui' });
  private hud = el('div', { class: 'hud' });
  private clockPill = el('div', { class: 'pill' });
  private moneyPill = el('div', { class: 'pill money' });
  private repPill = el('div', { class: 'pill' });
  private badges = {
    reports: el('span', { class: 'badge', hidden: true }),
    visitors: el('span', { class: 'badge', hidden: true }),
    menu: el('span', { class: 'badge', hidden: true }),
    room: el('span', { class: 'badge', hidden: true }),
  };
  /** Prepínač garáž / kaviareň v hornom paneli – viditeľný až po otvorení kaviarne. */
  private roomBtn = el('button', { class: 'icon-btn', type: 'button', hidden: true });
  private zuzka = el('div', { class: 'zuzka', hidden: true, role: 'status' });
  private zuzkaKey: string | null = null;
  private sheet = el('aside', { class: 'sheet empty', 'aria-live': 'polite' });
  private modal = el('div', { class: 'modal', hidden: true, role: 'dialog', 'aria-modal': 'true' });
  private toasts = el('div', { class: 'toasts' });
  private selectedId: string | null = null;
  private tab: CardTab = 'health';
  private tabFor: string | null = null;
  private busy = false;
  private muted = false;
  private modalKind: 'reports' | 'visitors' | 'menu' | 'welcome' | null = null;
  private menuTab: MenuTab = 'challenges';
  private confirmReset = false;
  private selectedForVisit: string | null = null;
  private dev: DevMenu;

  constructor(
    private state: GameState,
    private game: GameBridge,
  ) {
    try {
      this.muted = localStorage.getItem('meow:muted') === '1';
    } catch {
      /* úložisko nemusí byť dostupné */
    }
    this.game.setMuted(this.muted);
    const bridge = this.game;
    this.dev = new DevMenu(state, {
      get speed() {
        return bridge.speed;
      },
      setSpeed: (n) => bridge.setSpeed(n),
      selectedCatId: () => this.selectedId,
      toast: (msg) => this.toast(msg),
      saveNow: () => bridge.saveNow(),
      resetGame: () => bridge.resetGame(),
    });
    // Tajné: 5× rýchlo ťuknúť na hodiny otvorí vývojárske menu
    this.clockPill.addEventListener('pointerdown', () => this.dev.secretTap());
    this.clockPill.style.touchAction = 'manipulation';
    this.buildHud();
    this.root.append(this.hud, this.sheet, this.zuzka, this.modal, this.toasts);
    document.body.append(this.root);
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
    });
    this.subscribe();
    this.layout();
    window.addEventListener('resize', () => this.layout());
    this.renderSheet();
    this.updateHud();
    window.setInterval(() => this.tick(), 500);
  }

  // ---------- Rozloženie ----------

  private layout(): void {
    const l = computeLayout(window.innerWidth, window.innerHeight);
    this.root.classList.toggle('portrait', l.portrait);
    this.root.classList.toggle('landscape', !l.portrait);
    this.root.style.setProperty('--world-h', `${l.worldScreenH}px`);
  }

  // ---------- Horný panel ----------

  private buildHud(): void {
    const iconBtn = (
      icon: string,
      label: string,
      badge: HTMLElement | null,
      onClick: () => void,
    ) => {
      const b = el(
        'button',
        { class: 'icon-btn', type: 'button', title: label, 'aria-label': label },
        icon,
      );
      if (badge) b.append(badge);
      b.addEventListener('click', onClick);
      return b;
    };
    this.roomBtn.addEventListener('click', () =>
      this.game.showRoom(this.game.room === 'cafe' ? 'garage' : 'cafe'),
    );
    this.hud.append(
      this.clockPill,
      this.moneyPill,
      this.repPill,
      el('div', { class: 'spacer' }),
      this.roomBtn,
      iconBtn('📋', t('UI_REPORTS'), this.badges.reports, () => this.openModal('reports')),
      iconBtn('🚪', t('UI_VISITORS'), this.badges.visitors, () => this.openModal('visitors')),
      iconBtn('☰', t('UI_MENU'), this.badges.menu, () => this.openMenu()),
    );
  }

  private updateHud(): void {
    const s = this.state;
    const phaseIcon = { night: '🌙', morning: '🌅', day: '☀️', evening: '🌆' }[s.dayPhase];
    this.clockPill.textContent = `${phaseIcon} ${s.clock}`;
    const rate = s.donationsPerMinute;
    this.moneyPill.replaceChildren(
      `${Math.floor(s.money)} €`,
      rate > 0 ? el('small', {}, t('UI_PER_MIN', { n: round1(rate) })) : '',
    );
    this.repPill.textContent = `★ ${s.reputation}`;
    this.setBadge(this.badges.reports, s.reports.length);
    this.setBadge(this.badges.visitors, s.adopters.length);
    this.setBadge(this.badges.menu, s.claimableChallenges + this.unseenPostcards);
    this.updateRoomButton();
    this.updateZuzka();
  }

  private updateRoomButton(): void {
    const s = this.state;
    const inCafe = this.game.room === 'cafe';
    this.roomBtn.hidden = !s.cafe.open;
    const label = t(inCafe ? 'UI_GO_GARAGE' : 'UI_GO_CAFE');
    if (this.roomBtn.title !== label) {
      this.roomBtn.title = label;
      this.roomBtn.setAttribute('aria-label', label);
      this.roomBtn.replaceChildren(inCafe ? '🏥' : '☕', this.badges.room);
    }
    // Hostia čakajúci na obsluhu, kým je hráč v garáži
    this.setBadge(this.badges.room, inCafe ? 0 : s.waitingGuests.length);
  }

  /** Volá scéna po prepnutí miestnosti. */
  setRoom(_room: Room): void {
    this.updateHud();
    if (!this.selectedId) this.renderSheet();
  }

  private get unseenPostcards(): number {
    return this.state.adoptions.filter((a) => a.postcardDelivered && !a.postcardSeen).length;
  }

  /** Bublina s radou od Zuzky (tutoriál) – mení sa podľa postupu hráča. */
  private updateZuzka(): void {
    const key = this.state.tutorialHint;
    const hide = key === null || this.modalKind !== null;
    this.zuzka.hidden = hide;
    if (hide || key === this.zuzkaKey) return;
    this.zuzkaKey = key;
    const skip = el(
      'button',
      {
        class: 'close',
        type: 'button',
        'aria-label': t('UI_SKIP_TUTORIAL'),
        title: t('UI_SKIP_TUTORIAL'),
      },
      '✕',
    );
    skip.addEventListener('click', () => {
      this.state.dismissTutorial();
      this.updateZuzka();
    });
    this.zuzka.replaceChildren(personPortrait('012', 1.5), el('p', {}, t(key)), skip);
  }

  private setBadge(b: HTMLElement, n: number): void {
    b.hidden = n === 0;
    b.textContent = String(n);
  }

  private toggleMute(): void {
    this.muted = !this.muted;
    try {
      localStorage.setItem('meow:muted', this.muted ? '1' : '0');
    } catch {
      /* nevadí */
    }
    this.game.setMuted(this.muted);
    this.updateHud();
    if (this.modalKind === 'menu') this.renderModal();
  }

  private tick(): void {
    this.updateHud();
    // Odpočet prestávok na karte
    if (this.selectedId && !this.busy) this.renderSheet();
  }

  // ---------- Udalosti hry ----------

  private subscribe(): void {
    const bus = this.state.bus;
    bus.on('catSelected', ({ catId }) => {
      this.selectedId = catId;
      this.renderSheet();
    });
    bus.on('catChanged', ({ cat }) => {
      if (cat.id === this.selectedId) this.renderSheet();
    });
    bus.on('catAdmitted', ({ cat }) => {
      this.toast(t('TOAST_ADMITTED', { cat: cat.name }));
      this.renderSheet();
    });
    bus.on('reportAdded', () => {
      this.toast(t('TOAST_NEW_REPORT'));
      this.game.playSound('notify', 0.5);
      if (this.modalKind === 'reports') this.renderModal();
    });
    bus.on('adopterArrived', () => {
      this.toast(t('TOAST_VISITOR'));
      this.game.playSound('doorbell', 0.5, 'notify');
      if (this.modalKind === 'visitors') this.renderModal();
    });
    bus.on('catBecameReady', ({ cat }) => {
      this.toast(t('TOAST_READY', { cat: cat.name }));
      this.game.playSound('mewPurr', 0.5);
    });
    bus.on('postcardArrived', () => {
      this.toast(t('TOAST_POSTCARD'));
      this.game.playSound('camera', 0.5, 'notify');
    });
    bus.on('catAdopted', ({ record }) => {
      if (this.selectedId === record.cat.id) this.game.select(null);
      this.renderSheet();
    });
    bus.on('catBecameResident', ({ cat }) => this.toast(t('TOAST_RESIDENT', { cat: cat.name })));
    bus.on('challengeCompleted', () => {
      this.toast(t('TOAST_CHALLENGE'));
      this.game.playSound('success', 0.5);
      this.updateHud();
      if (this.modalKind === 'menu') this.renderModal();
    });
    bus.on('albumAdded', () => this.toast(t('TOAST_ALBUM')));
    bus.on('upgradeBought', ({ kind }) => {
      const key = {
        cage: 'TOAST_BOUGHT_CAGE',
        slot: 'TOAST_BOUGHT_SLOT',
        cafe: 'TOAST_CAFE_OPEN',
        table: 'TOAST_BOUGHT_TABLE',
      }[kind];
      this.toast(t(key));
      this.game.playSound('upgrade', 0.6);
      this.updateHud();
    });
    // Mačacia kaviareň (GDD §5.5)
    const refreshCafe = () => {
      this.updateHud();
      if (!this.selectedId && this.game.room === 'cafe') this.renderSheet();
    };
    bus.on('guestArrived', () => {
      if (this.game.room !== 'cafe') this.toast(t('TOAST_GUEST'));
      this.game.playSound('doorbell', 0.4, 'notify');
      refreshCafe();
    });
    bus.on('guestServed', () => {
      this.game.playSound('success', 0.4);
      refreshCafe();
    });
    bus.on('guestLeft', ({ amount }) => {
      this.toast(t('TOAST_GUEST_TIP', { n: round1(amount) }));
      this.game.playSound('coins', 0.5, 'drop');
      refreshCafe();
    });
    bus.on('welcomeBack', ({ summary }) => {
      if (summary.minutes < 1) return;
      this.openModal(
        'welcome',
        [
          summary.reports > 0 ? t('UI_WELCOME_REPORTS', { n: summary.reports }) : '',
          summary.donations > 0 ? t('UI_WELCOME_DONATIONS', { n: summary.donations }) : '',
          summary.postcards > 0 ? t('UI_WELCOME_POSTCARDS', { n: summary.postcards }) : '',
        ].filter(Boolean),
      );
    });
  }

  toast(text: string): void {
    const node = el('div', { class: 'toast' }, text);
    this.toasts.append(node);
    while (this.toasts.childElementCount > 3) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => node.remove(), 2800);
  }

  // ---------- Karta mačky ----------

  private renderSheet(): void {
    const cat = this.selectedId ? this.state.getCat(this.selectedId) : undefined;
    this.sheet.classList.toggle('empty', !cat);
    if (!cat) {
      this.renderCatList();
      return;
    }
    if (cat.id !== this.tabFor) {
      this.tabFor = cat.id;
      this.tab = this.defaultTab(cat);
    }
    const s = this.state;
    const data = s.data;
    const ready = s.isReady(cat);
    const breed = data.breeds.find((b) => b.id === cat.breedId);
    const coat = data.coats.find((c) => c.id === cat.coatId);
    const status = cat.resident
      ? el('span', { class: 'chip info' }, t('UI_STATUS_RESIDENT'))
      : ready
        ? el('span', { class: 'chip good' }, t('UI_STATUS_READY'))
        : el('span', { class: 'chip warn' }, t('UI_STATUS_TREATMENT'));

    const close = el(
      'button',
      { class: 'close', type: 'button', 'aria-label': t('UI_CLOSE') },
      '✕',
    );
    close.addEventListener('click', () => this.game.select(null));

    // Hlavička: portrét, meno, stav – v jednom riadku
    const head = el(
      'div',
      { class: 'card-head' },
      catPortrait(cat, 2),
      el(
        'div',
        { class: 'who' },
        el('h2', {}, cat.name, ' ', status),
        el(
          'div',
          { class: 'sub' },
          [breed && t(breed.name_key), coat && t(coat.name_key), t(`AGE_${cat.age.toUpperCase()}`)]
            .filter(Boolean)
            .join(' · '),
        ),
      ),
      close,
    );

    // Štatistiky v mriežke 2×2
    const stats = el('div', { class: 'stats' });
    for (const key of Object.keys(STAT_KEYS) as (keyof CatStats)[]) {
      const v = Math.round(cat.stats[key]);
      stats.append(
        el(
          'div',
          { class: 'stat' },
          el('span', {}, t(STAT_KEYS[key])),
          el('span', { class: 'val' }, String(v)),
          el(
            'div',
            { class: 'bar' },
            el('i', { style: `width:${v}%;background:${STAT_COLORS[key]}` }),
          ),
        ),
      );
    }

    // Záložky namiesto jedného dlhého zoznamu – karta sa vojde bez rolovania
    const needsHealth =
      !cat.resident &&
      (cat.conditions.some((c) => c.revealed && !c.treated) || cat.examined.length < 3 || ready);
    const tabs: { id: CardTab; label: string; dot: boolean }[] = [
      { id: 'health', label: `🩺 ${t('TAB_HEALTH')}`, dot: needsHealth },
      { id: 'care', label: `❤️ ${t('TAB_CARE')}`, dot: false },
      { id: 'about', label: `🐾 ${t('TAB_ABOUT')}`, dot: false },
    ];
    const tabBar = el('div', { class: 'tabs', role: 'tablist' });
    for (const tb of tabs) {
      const b = el(
        'button',
        {
          class: `tab${this.tab === tb.id ? ' active' : ''}`,
          type: 'button',
          role: 'tab',
          'aria-selected': this.tab === tb.id ? 'true' : 'false',
        },
        tb.label,
        tb.dot && this.tab !== tb.id ? el('span', { class: 'dot' }) : '',
      );
      b.addEventListener('click', () => {
        this.tab = tb.id;
        this.renderSheet();
      });
      tabBar.append(b);
    }

    const body =
      this.tab === 'health'
        ? this.healthTab(cat, ready)
        : this.tab === 'care'
          ? this.careTab(cat)
          : this.aboutTab(cat);

    this.sheet.replaceChildren(head, stats, tabBar, el('div', { class: 'tab-body' }, ...body));
  }

  private defaultTab(cat: CatData): CardTab {
    if (cat.resident) return 'care';
    return 'health';
  }

  /** Liečba: diagnózy, prehliadka; hotová mačka – adopcia alebo stálica. */
  private healthTab(cat: CatData, ready: boolean): HTMLElement[] {
    const s = this.state;
    const data = s.data;
    if (cat.resident) return [el('p', { class: 'hint' }, t('UI_RESIDENT_HINT'))];

    const out: HTMLElement[] = [];
    if (ready) {
      const full = s.freeResidentSlots <= 0;
      out.push(
        el('p', { class: 'hint' }, t('UI_READY_HINT')),
        el(
          'div',
          { class: 'actions' },
          button(`🏠 ${t('UI_KEEP')}`, () => this.doKeep(cat), {
            class: 'btn primary',
            disabled: full,
          }),
          button(
            `🚪 ${t('UI_VISITORS')} (${s.adopters.length})`,
            () => this.openModal('visitors'),
            {
              disabled: s.adopters.length === 0,
            },
          ),
        ),
      );
      if (full)
        out.push(
          el('p', { class: 'hint' }, t('UI_KEEP_FULL', { max: data.balance.residents.slots })),
        );
      return out;
    }

    const list = el('ul', { class: 'list' });
    for (const c of cat.conditions) {
      const def = data.conditions.find((d) => d.id === c.id);
      if (!c.revealed) {
        list.append(el('li', { class: 'row muted' }, t('UI_COND_HIDDEN')));
      } else if (c.treated) {
        list.append(
          el(
            'li',
            { class: 'row' },
            el('span', {}, t(def?.name_key ?? c.id)),
            el('span', { class: 'done' }, `✓ ${t('UI_TREATED')}`),
          ),
        );
      } else {
        list.append(
          el(
            'li',
            { class: 'row' },
            el('span', {}, t(def?.name_key ?? c.id)),
            button(`🩹 ${t('UI_TREAT')}`, () => void this.doTreat(cat, c.id), {
              class: 'btn primary',
              disabled: this.busy,
            }),
          ),
        );
      }
    }
    out.push(list);

    const tools: [DiagnosticTool, string, string][] = [
      ['hand', '✋', 'UI_TOOL_HAND'],
      ['thermometer', '🌡️', 'UI_TOOL_THERMOMETER'],
      ['stethoscope', '🩺', 'UI_TOOL_STETHOSCOPE'],
    ];
    const pending = tools.filter(([tool]) => !cat.examined.includes(tool));
    if (pending.length > 0) {
      out.push(
        el(
          'div',
          { class: 'actions' },
          ...pending.map(([tool, icon, key]) =>
            button(`${icon} ${t(key)}`, () => this.doExamine(cat, tool), { disabled: this.busy }),
          ),
        ),
      );
    }
    return out;
  }

  /** Starostlivosť: socializácia a kŕmenie. */
  private careTab(cat: CatData): HTMLElement[] {
    const s = this.state;
    const socialLeft = Math.ceil(s.socialCooldownLeft(cat.id) / 1000);
    const feedLeft = Math.ceil(s.feedCooldownLeft(cat.id) / 1000);
    const care = el('div', { class: 'actions' });
    for (const a of SOCIAL) {
      const b = button(`${a.icon} ${t(a.key)}`, () => void this.doSocial(cat, a), {
        disabled: this.busy || socialLeft > 0,
      });
      if (socialLeft > 0) b.append(el('small', {}, t('UI_RESTING', { s: socialLeft })));
      care.append(b);
    }
    const feedBtn = button(`🍽️ ${t('ACT_FEED')}`, () => this.doFeed(cat), {
      class: 'btn wide',
      disabled: this.busy || feedLeft > 0,
    });
    if (feedLeft > 0) feedBtn.append(el('small', {}, t('UI_RESTING', { s: feedLeft })));
    care.append(feedBtn);
    return [care];
  }

  /** O mačke: povaha a odkiaľ prišla. */
  private aboutTab(cat: CatData): HTMLElement[] {
    const data = this.state.data;
    const known = cat.traits.filter((tr) => tr.revealed);
    const hidden = cat.traits.length - known.length;
    const report = data.reports.find((r) => r.id === cat.reportId);
    return [
      el('h3', {}, t('UI_TRAITS')),
      el(
        'div',
        {},
        ...known.map((tr) =>
          el(
            'span',
            { class: 'chip', style: 'margin-right:4px' },
            t(data.traits.find((d) => d.id === tr.id)?.name_key ?? tr.id),
          ),
        ),
        hidden > 0 ? el('span', { class: 'muted' }, ` ${t('UI_UNKNOWN')}`) : '',
      ),
      el('p', { class: 'hint' }, t('UI_TRAITS_HINT')),
      report
        ? el('p', { class: 'hint' }, t('UI_FOUND_AT', { where: t(report.name_key) }))
        : el('span'),
    ];
  }

  /** Bez vybranej mačky (na mobile na výšku): zoznam mačiek a voľných klietok. */
  private renderCatList(): void {
    if (this.game.room === 'cafe') {
      this.renderCafePanel();
      return;
    }
    const s = this.state;
    const tiles = s.cats.map((cat) => this.catTile(cat));
    this.sheet.replaceChildren(
      el('p', { class: 'hint' }, t('UI_TAP_CAT')),
      el('div', { class: 'cat-list' }, ...tiles),
      el(
        'p',
        { class: 'hint' },
        `${t('UI_FREE_CAGES', { free: s.freeCages, total: s.cageCount })} · ${t('UI_RESIDENTS', { n: s.residents.length, max: s.residentSlots })}`,
      ),
      s.reports.length > 0
        ? button(`📋 ${t('UI_REPORTS')} (${s.reports.length})`, () => this.openModal('reports'), {
            class: 'btn primary',
          })
        : '',
    );
  }

  /** Panel kaviarne: hostia s objednávkami (obsluha ťuknutím) a stálice (GDD §5.5). */
  private renderCafePanel(): void {
    const s = this.state;
    const guests = [...s.cafe.guests].sort((a, b) => Number(a.served) - Number(b.served));
    const rows = guests.map((g) =>
      el(
        'div',
        { class: 'guest' },
        personPortrait(g.sprite, 1.25),
        el(
          'span',
          { class: 'grow' },
          t('UI_GUEST_WANTS', { order: t(`ORDER_${g.order.toUpperCase()}`) }),
        ),
        g.served
          ? el('span', { class: 'chip good' }, t('UI_SERVED'))
          : button(
              `${ORDER_ICON[g.order]} ${t('UI_SERVE')}`,
              () => {
                if (s.serveGuest(g.id)) this.renderSheet();
              },
              { class: 'btn primary' },
            ),
      ),
    );
    const residents = s.residents.map((cat) => this.catTile(cat));
    this.sheet.replaceChildren(
      el('h2', {}, `☕ ${t('UI_CAFE')}`),
      el(
        'p',
        { class: 'hint' },
        t('UI_CAFE_LINE', {
          n: s.residents.length,
          max: s.residentSlots,
          tables: s.tableCount,
          d: round1(s.donationsPerMinute),
        }),
      ),
      s.residents.length === 0
        ? el('p', { class: 'warning' }, t('UI_CAFE_NO_RESIDENTS'))
        : rows.length === 0
          ? el('p', { class: 'muted' }, t('UI_CAFE_NO_GUESTS'))
          : el('div', { class: 'guests' }, ...rows),
      residents.length ? el('div', { class: 'cat-list' }, ...residents) : '',
    );
  }

  private catTile(cat: CatData): HTMLButtonElement {
    const s = this.state;
    const b = el(
      'button',
      { class: 'btn cat-tile', type: 'button' },
      catPortrait(cat, 1.5),
      el(
        'span',
        {},
        cat.name,
        el('br'),
        el(
          'small',
          {},
          cat.resident
            ? t('UI_STATUS_RESIDENT')
            : s.isReady(cat)
              ? t('UI_STATUS_READY')
              : t('UI_STATUS_TREATMENT'),
        ),
      ),
    );
    b.addEventListener('click', () => this.game.select(cat.id));
    return b;
  }

  // ---------- Akcie ----------

  private doExamine(cat: CatData, tool: DiagnosticTool): void {
    const found = this.state.examine(cat.id, tool);
    this.game.playSound(found.length ? 'found' : 'nothing', 0.5);
    const names = found.map((id) =>
      t(this.state.data.conditions.find((d) => d.id === id)?.name_key ?? id),
    );
    this.toast(found.length ? t('UI_FOUND', { list: names.join(', ') }) : t('UI_FOUND_NOTHING'));
  }

  private async doTreat(cat: CatData, conditionId: string): Promise<void> {
    const def = this.state.data.conditions.find((d) => d.id === conditionId);
    const game = def && TREATMENT_GAMES[def.minigame];
    if (!game) return;
    const stars = await this.runMinigame({ kind: game.kind, cat, title: t(game.titleKey) });
    if (stars === null) return;
    this.state.treat(cat.id, conditionId, stars);
    this.toast(`${t(def.name_key)}: ${t('UI_TREATED')} ${'★'.repeat(stars)}`);
  }

  private async doSocial(cat: CatData, a: (typeof SOCIAL)[number]): Promise<void> {
    const stars = await this.runMinigame({ kind: a.kind, cat, title: t(a.title) });
    if (stars === null) return;
    const result = this.state.socialize(cat.id, a.id, stars);
    if (!result) return;
    this.toast(
      t(
        result.reaction === 'love'
          ? 'REACT_LOVE'
          : result.reaction === 'meh'
            ? 'REACT_MEH'
            : 'REACT_OK',
      ),
    );
    for (const id of result.revealed) {
      const name = t(this.state.data.traits.find((d) => d.id === id)?.name_key ?? id);
      this.toast(t('UI_TRAIT_REVEALED', { trait: name }));
    }
    this.game.playSound(result.reaction === 'meh' ? 'mew' : 'mewPurr', 0.5);
  }

  private doFeed(cat: CatData): void {
    if (this.state.feed(cat.id)) {
      this.game.playSound('kibble', 0.5);
      this.game.playSound('mewFood', 0.6);
    }
  }

  private doKeep(cat: CatData): void {
    if (this.state.makeResident(cat.id)) this.game.playSound('mewPurr', 0.6);
  }

  private async runMinigame(req: MinigameRequest): Promise<Stars | null> {
    this.busy = true;
    document.body.classList.add('minigame');
    try {
      return await this.game.runMinigame(req);
    } finally {
      document.body.classList.remove('minigame');
      this.busy = false;
      this.renderSheet();
    }
  }

  // ---------- Modálne okná ----------

  private welcomeLines: string[] = [];

  private openModal(kind: NonNullable<UI['modalKind']>, lines: string[] = []): void {
    this.modalKind = kind;
    this.welcomeLines = lines;
    this.selectedForVisit = null;
    if (this.modal.hidden) this.game.playSound('open', 0.4);
    this.modal.hidden = false;
    this.renderModal();
  }

  private closeModal(): void {
    if (!this.modal.hidden) this.game.playSound('close', 0.4);
    this.modal.hidden = true;
    this.modalKind = null;
    this.confirmReset = false;
    this.updateHud();
  }

  private openMenu(tab?: MenuTab): void {
    // Najprv to, čo čaká: splnená výzva, potom nová pohľadnica
    this.menuTab =
      tab ??
      (this.state.claimableChallenges > 0
        ? 'challenges'
        : this.unseenPostcards > 0
          ? 'postcards'
          : this.menuTab);
    this.openModal('menu');
  }

  private renderModal(): void {
    const box = el('div', { class: 'modal-box' });
    const closeBtn = button(t('UI_CLOSE'), () => this.closeModal(), { class: 'btn' });
    switch (this.modalKind) {
      case 'reports':
        box.append(...this.reportsContent(), closeBtn);
        break;
      case 'visitors':
        box.append(...this.visitorContent());
        break;
      case 'menu':
        box.append(...this.menuContent(), closeBtn);
        break;
      case 'welcome':
        box.append(
          el('h2', {}, t('UI_WELCOME')),
          ...(this.welcomeLines.length ? this.welcomeLines : [t('UI_WELCOME_NOTHING')]).map((l) =>
            el('p', { style: 'margin:0' }, l),
          ),
          button('OK', () => this.closeModal(), { class: 'btn primary' }),
        );
        break;
      default:
        return;
    }
    this.modal.replaceChildren(box);
  }

  private reportsContent(): HTMLElement[] {
    const s = this.state;
    const out: HTMLElement[] = [
      el('h2', {}, t('UI_REPORTS')),
      el('p', { class: 'hint' }, t('UI_FREE_CAGES', { free: s.freeCages, total: s.cageCount })),
    ];
    if (s.reports.length === 0) out.push(el('p', { class: 'muted' }, t('UI_NO_REPORTS')));
    if (s.reports.length > 0 && s.freeCages <= 0)
      out.push(el('p', { class: 'warning' }, t('UI_NO_CAGE')));
    for (const r of s.reports) {
      const def = s.data.reports.find((d) => d.id === r.defId);
      if (!def) continue;
      out.push(
        el(
          'div',
          { class: 'report' },
          el('strong', {}, t(def.name_key)),
          el(
            'span',
            { class: 'muted' },
            `${t('UI_DIFFICULTY')}: `,
            el('span', { class: 'paws' }, paws(def.difficulty)),
          ),
          el(
            'div',
            { class: 'btns' },
            button(
              t('UI_ACCEPT'),
              () => {
                const cat = s.acceptReport(r.id);
                if (cat) {
                  this.closeModal();
                  this.game.playSound('van', 0.5);
                  this.game.playSound('mew', 0.6);
                  this.game.select(cat.id);
                }
              },
              { class: 'btn primary', disabled: s.freeCages <= 0 },
            ),
            button(t('UI_DECLINE'), () => {
              s.declineReport(r.id);
              this.renderModal();
            }),
          ),
        ),
      );
    }
    return out;
  }

  private visitorContent(): HTMLElement[] {
    const s = this.state;
    const visit = s.adopters[0];
    const def = visit && s.adopterDef(visit.id);
    const close = button(t('UI_CLOSE'), () => this.closeModal(), { class: 'btn' });
    if (!visit || !def)
      return [el('h2', {}, t('UI_VISITORS')), el('p', { class: 'muted' }, t('UI_NO_READY')), close];

    const head = el(
      'div',
      { class: 'visitor-head' },
      personPortrait(visit.sprite),
      el(
        'div',
        {},
        el('div', { class: 'sub' }, t('UI_VISITOR_TITLE')),
        el('h2', {}, t(def.name_key)),
        el('p', { style: 'margin:4px 0' }, t(def.desc_key)),
        el(
          'div',
          {},
          ...def.tags.map((tag) =>
            el('span', { class: 'chip', style: 'margin-right:4px' }, t(`TAG_${tag}`)),
          ),
        ),
      ),
    );

    const ready = s.cats.filter((c) => s.isReady(c));
    const list = el('div', { class: 'list' });
    let chosen: MatchResult | null = null;
    for (const cat of ready) {
      const m = s.matchFor(cat.id, visit.id);
      if (!m) continue;
      if (cat.id === this.selectedForVisit) chosen = m;
      const quality = { perfect: 'good', good: 'info', poor: 'warn', blocked: 'bad' }[m.quality];
      const row = el(
        'button',
        {
          class: `btn row match-row${cat.id === this.selectedForVisit ? ' selected' : ''}`,
          type: 'button',
          disabled: m.quality === 'blocked',
        },
        catPortrait(cat, 1.5),
        el(
          'span',
          { style: 'flex:1' },
          cat.name,
          el('br'),
          el('small', {}, m.uncertain ? t('UI_MATCH_UNCERTAIN') : ''),
        ),
        el(
          'span',
          {},
          el('span', { class: 'match-score' }, m.quality === 'blocked' ? '–' : `${m.score} %`),
          el('br'),
          el('span', { class: `chip ${quality}` }, t(`MATCH_${m.quality.toUpperCase()}`)),
        ),
      );
      row.addEventListener('click', () => {
        this.selectedForVisit = cat.id;
        this.renderModal();
      });
      list.append(row);
    }

    const adopt = button(
      t('UI_ADOPT'),
      () => {
        if (!this.selectedForVisit) return;
        const rec = s.adopt(this.selectedForVisit, visit.id);
        if (!rec) return;
        this.toast(t('UI_ADOPTED', { cat: rec.cat.name, fee: rec.fee }));
        this.game.playSound('mewPurr', 0.7);
        this.game.playSound('coins', 0.4);
        this.selectedForVisit = null;
        if (s.adopters.length > 0) this.renderModal();
        else this.closeModal();
      },
      { class: 'btn primary', disabled: !chosen || chosen.quality === 'blocked' },
    );

    const notNow = button(t('UI_NOT_NOW'), () => {
      s.dismissAdopter(visit.id);
      this.selectedForVisit = null;
      if (s.adopters.length > 0) this.renderModal();
      else this.closeModal();
    });

    const parts: (HTMLElement | null)[] = [
      head,
      el('h3', { style: 'margin:0;color:var(--ui-accent)' }, t('UI_PICK_CAT')),
      ready.length ? list : el('p', { class: 'muted' }, t('UI_NO_READY')),
      chosen?.quality === 'poor' ? el('p', { class: 'warning' }, t('UI_POOR_WARNING')) : null,
      el('div', { class: 'footer' }, notNow, adopt),
      close,
    ];
    return parts.filter((x): x is HTMLElement => x !== null);
  }

  // ---------- Menu: výzvy, album, pohľadnice, garáž ----------

  private menuContent(): HTMLElement[] {
    const tabs: { id: MenuTab; label: string; badge: number }[] = [
      {
        id: 'challenges',
        label: `🎯 ${t('MENU_CHALLENGES')}`,
        badge: this.state.claimableChallenges,
      },
      { id: 'album', label: `📖 ${t('MENU_ALBUM')}`, badge: 0 },
      { id: 'postcards', label: `💌 ${t('MENU_POSTCARDS')}`, badge: this.unseenPostcards },
      { id: 'garage', label: `🔨 ${t('MENU_GARAGE')}`, badge: 0 },
    ];
    const bar = el('div', { class: 'tabs menu-tabs', role: 'tablist' });
    for (const tb of tabs) {
      const b = el(
        'button',
        {
          class: `tab${this.menuTab === tb.id ? ' active' : ''}`,
          type: 'button',
          role: 'tab',
          'aria-selected': this.menuTab === tb.id ? 'true' : 'false',
        },
        tb.label,
        tb.badge > 0 && this.menuTab !== tb.id ? el('span', { class: 'dot' }) : '',
      );
      b.addEventListener('click', () => {
        this.menuTab = tb.id;
        this.confirmReset = false;
        this.renderModal();
      });
      bar.append(b);
    }
    const body =
      this.menuTab === 'challenges'
        ? this.challengesContent()
        : this.menuTab === 'album'
          ? this.albumContent()
          : this.menuTab === 'postcards'
            ? this.postcardsContent()
            : this.garageContent();
    return [bar, ...body];
  }

  private challengesContent(): HTMLElement[] {
    const s = this.state;
    const out: HTMLElement[] = [el('p', { class: 'hint' }, t('UI_CHALLENGES_HINT'))];
    for (const ch of s.challenges) {
      const def = s.challengeDef(ch.defId);
      if (!def) continue;
      const progress = Math.min(ch.target, s.challengeProgress(ch));
      const pct = Math.round((progress / ch.target) * 100);
      out.push(
        el(
          'div',
          { class: `challenge${ch.completed ? ' done' : ''}` },
          el(
            'div',
            { class: 'row' },
            el('strong', {}, t(def.name_key)),
            el('span', { class: 'match-score' }, `${progress} / ${ch.target}`),
          ),
          el(
            'div',
            { class: 'bar' },
            el('i', {
              style: `width:${pct}%;background:${ch.completed ? 'var(--ui-good)' : 'var(--ui-accent)'}`,
            }),
          ),
          el(
            'div',
            { class: 'row' },
            el('span', { class: 'muted' }, `${t('UI_REWARD')}: ${def.money} € · ★ ${def.rep}`),
            ch.completed
              ? button(
                  `🎁 ${t('UI_CLAIM')}`,
                  () => {
                    const got = s.claimChallenge(def.id);
                    if (got) {
                      this.toast(t('TOAST_CLAIMED', { money: got.money, rep: got.rep }));
                      this.game.playSound('coins', 0.5, 'mewPurr');
                    }
                    this.renderModal();
                    this.updateHud();
                  },
                  { class: 'btn primary' },
                )
              : '',
          ),
        ),
      );
    }
    return out;
  }

  private albumContent(): HTMLElement[] {
    const s = this.state;
    const data = s.data;
    const filled = Object.keys(s.album).length;
    const grid = el('div', { class: 'album' });
    for (const breed of data.breeds) {
      grid.append(el('div', { class: 'album-breed' }, t(breed.name_key)));
      for (const coat of data.coats) {
        const entry = s.album[GameState.albumKey(breed.id, coat.id)];
        const label = `${t(breed.name_key)} · ${t(coat.name_key)}`;
        if (!entry) {
          grid.append(
            el('div', { class: 'album-cell empty', title: label, 'aria-label': label }, '?'),
          );
          continue;
        }
        const cell = el(
          'button',
          {
            class: 'album-cell',
            type: 'button',
            title: `${entry.name} – ${label}`,
            'aria-label': `${entry.name} – ${label}`,
          },
          catPortrait(
            { sprite: entry.sprite, name: entry.name, stats: { cleanliness: 100 } } as CatData,
            1.4,
          ),
          entry.count > 1 ? el('span', { class: 'album-count' }, `×${entry.count}`) : '',
        );
        cell.addEventListener('click', () =>
          this.toast(
            `${t(entry.how === 'adopted' ? 'UI_ALBUM_ADOPTED' : 'UI_ALBUM_RESIDENT', { cat: entry.name })} (${t(coat.name_key)})`,
          ),
        );
        grid.append(cell);
      }
    }
    return [
      el(
        'div',
        { class: 'row' },
        el('strong', {}, t('UI_ALBUM_PROGRESS', { n: filled, total: s.albumSize })),
      ),
      el(
        'div',
        { class: 'bar' },
        el('i', { style: `width:${(filled / s.albumSize) * 100}%;background:var(--ui-accent)` }),
      ),
      el('p', { class: 'hint' }, t('UI_ALBUM_HINT')),
      grid,
    ];
  }

  private garageContent(): HTMLElement[] {
    const s = this.state;
    const cagePrice = s.nextCagePrice;
    const slotPrice = s.nextSlotPrice;
    const out: HTMLElement[] = [
      el(
        'p',
        { class: 'hint' },
        t('UI_STATS_LINE', { r: s.counters.rescued, a: s.counters.adopted }),
      ),
      el(
        'div',
        { class: 'upgrade' },
        el('strong', {}, `🐈 ${t('UI_CAGES', { n: s.cageCount })}`),
        cagePrice === null
          ? el('span', { class: 'muted' }, t('UI_MAXED'))
          : button(
              t('UI_BUY_CAGE', { price: cagePrice }),
              () => {
                s.buyCage();
                this.renderModal();
              },
              { class: 'btn primary', disabled: s.money < cagePrice },
            ),
      ),
      el(
        'div',
        { class: 'upgrade' },
        el('strong', {}, `🛋️ ${t('UI_SLOTS', { n: s.residentSlots })}`),
        slotPrice === null
          ? el('span', { class: 'muted' }, t('UI_MAXED'))
          : button(
              t('UI_BUY_SLOT', { price: slotPrice }),
              () => {
                s.buySlot();
                this.renderModal();
              },
              { class: 'btn primary', disabled: s.money < slotPrice },
            ),
      ),
      this.cafeUpgrade(),
      button(this.muted ? `🔇 ${t('UI_SOUND_OFF')}` : `🔊 ${t('UI_SOUND_ON')}`, () =>
        this.toggleMute(),
      ),
    ];
    if (!this.confirmReset) {
      out.push(
        button(`↺ ${t('UI_NEW_GAME')}`, () => {
          this.confirmReset = true;
          this.renderModal();
        }),
      );
    } else {
      out.push(
        el('p', { class: 'warning' }, t('UI_NEW_GAME_CONFIRM')),
        el(
          'div',
          { class: 'footer' },
          button(t('UI_CANCEL'), () => {
            this.confirmReset = false;
            this.renderModal();
          }),
          button(t('UI_YES_DELETE'), () => this.game.resetGame(), { class: 'btn primary' }),
        ),
      );
    }
    return out;
  }

  /** Kúpa kaviarne, potom dokupovanie stolov (GDD §5.5). */
  private cafeUpgrade(): HTMLElement {
    const s = this.state;
    if (!s.cafe.open) {
      const price = s.data.balance.cafe.price;
      return el(
        'div',
        { class: 'upgrade cafe' },
        el(
          'div',
          {},
          el('strong', {}, `☕ ${t('UI_CAFE')}`),
          el('p', { class: 'hint' }, t('UI_CAFE_DESC', { slots: s.data.balance.cafe.slots })),
        ),
        button(
          t('UI_BUY_CAFE', { price }),
          () => {
            if (s.buyCafe()) this.closeModal();
          },
          { class: 'btn primary', disabled: s.money < price },
        ),
      );
    }
    const price = s.nextTablePrice;
    return el(
      'div',
      { class: 'upgrade' },
      el('strong', {}, `🪑 ${t('UI_TABLES', { n: s.tableCount })}`),
      price === null
        ? el('span', { class: 'muted' }, t('UI_MAXED'))
        : button(
            t('UI_BUY_TABLE', { price }),
            () => {
              s.buyTable();
              this.renderModal();
            },
            { class: 'btn primary', disabled: s.money < price },
          ),
    );
  }

  private postcardsContent(): HTMLElement[] {
    const cards = this.state.adoptions.filter((a) => a.postcardDelivered).reverse();
    const out: HTMLElement[] = [];
    if (cards.length === 0) out.push(el('p', { class: 'muted' }, t('UI_NO_POSTCARDS')));
    for (const rec of cards) {
      out.push(this.postcard(rec));
      this.state.markPostcardSeen(rec);
    }
    return out;
  }

  private postcard(rec: AdoptionRecord): HTMLElement {
    const def = this.state.data.adopters.find((d) => d.id === rec.adopterDefId);
    const person = personPortrait(rec.adopterSprite, 3);
    person.style.left = '30%';
    const cat = catPortrait(rec.cat, 3);
    cat.style.left = '48%';
    cat.style.filter = '';
    const key =
      rec.score >= this.state.data.balance.match.perfect ? 'POSTCARD_PERFECT' : 'POSTCARD_GOOD';
    return el(
      'div',
      { class: 'postcard' },
      el('div', { class: 'scene' }, person, cat),
      el('p', {}, t(key, { cat: rec.cat.name })),
      el('p', { class: 'from' }, t('UI_POSTCARD_FROM', { who: t(def?.name_key ?? '') })),
    );
  }
}
