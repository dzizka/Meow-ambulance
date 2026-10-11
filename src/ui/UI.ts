import './ui.css';
import { IMAGES, catSheetPath, personSheetPath } from '../assets';
import { CLINIC_FRAMES, INTERIOR_FRAMES, type FrameRect } from '../data/frames';
import { GameState } from '../core/GameState';
import type { Stars } from '../core/systems/Care';
import type { MatchResult } from '../core/systems/Match';
import type {
  AdoptionRecord,
  CatData,
  ClinicRoomId,
  CatStats,
  DecorDef,
  DiagnosticTool,
  SocialActivity,
} from '../data/types';
import { generateCat } from '../core/systems/CatGenerator';
import { Rng } from '../core/Rng';
import { lang, setLang, t } from '../i18n/t';
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
  /** Id stálic, ktoré sú práve vonku vo výbehu. */
  catsOutside(): string[];
  /** Vývojárske menu: rýchlosť času a okamžité uloženie. */
  readonly speed: number;
  setSpeed(speed: number): void;
  saveNow(): void;
}

export type MinigameKind =
  | 'tick_removal'
  | 'bandage'
  | 'ears'
  | 'syrup'
  | 'breath'
  | 'bath'
  | 'claws'
  | 'drops'
  | 'vaccine'
  | 'bloodtest'
  | 'xray'
  | 'surgery'
  | 'splint'
  | 'ct'
  | 'swim'
  | 'quiz'
  | 'feather'
  | 'hold'
  | 'quiet';
export interface MinigameRequest {
  kind: MinigameKind;
  cat: CatData;
  title: string;
  /** Röntgen: čo je na snímke (skrytá diagnóza mačky), null = nič. */
  xray?: 'fracture' | 'swallowed' | null;
  /** Operácia je kastrácia (bez kroku s pinzetou). */
  neuter?: boolean;
}

/** Druh minihry podľa ošetrenia alebo aktivity (GDD §4.2, §4.3). */
const TREATMENT_GAMES: Record<string, { kind: MinigameKind; titleKey: string }> = {
  tick_removal: { kind: 'tick_removal', titleKey: 'MG_TICK_TITLE' },
  bandage: { kind: 'bandage', titleKey: 'HOLD_BANDAGE' },
  ear_cleaning: { kind: 'ears', titleKey: 'HOLD_EAR' },
  syrup: { kind: 'syrup', titleKey: 'HOLD_SYRUP' },
  hold_brush: { kind: 'hold', titleKey: 'HOLD_BRUSH' },
  inhalation: { kind: 'breath', titleKey: 'MG_BREATH_TITLE' },
  bath: { kind: 'bath', titleKey: 'MG_BATH_TITLE' },
  nail_trim: { kind: 'claws', titleKey: 'MG_CLAWS_TITLE' },
  ear_drops: { kind: 'drops', titleKey: 'MG_DROPS_TITLE' },
  insulin: { kind: 'vaccine', titleKey: 'MG_INSULIN_TITLE' },
  splint: { kind: 'splint', titleKey: 'MG_SPLINT_TITLE' },
  swim: { kind: 'swim', titleKey: 'MG_SWIM_TITLE' },
  surgery: { kind: 'surgery', titleKey: 'MG_SURGERY_TITLE' },
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
type MenuTab = 'challenges' | 'achievements' | 'album' | 'postcards' | 'shop' | 'more';
/** Časti obchodu – aby sa nemuselo dlho rolovať. */
type ShopTab = 'build' | 'equipment' | 'staff' | 'decor';

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

/** Náhľad dekorácie: výrez z hárka interiéru alebo kliniky cez CSS. */
function decorPreview(def: DecorDef): HTMLElement {
  const frames = def.sheet === 'interior' ? INTERIOR_FRAMES : CLINIC_FRAMES;
  const [x, y, w, h] = frames[def.frame as keyof typeof frames] as FrameRect;
  const scale = Math.min(2, 30 / Math.max(w, h));
  const url = def.sheet === 'interior' ? IMAGES.interior : IMAGES.clinic;
  return el('div', {
    class: 'sprite',
    style: `width:${w * scale}px;height:${h * scale}px;background-image:url(${url});background-position:${-x * scale}px ${-y * scale}px;background-size:${512 * scale}px ${(def.sheet === 'interior' ? 448 : 512) * scale}px`,
  });
}

const paws = (n: number): string => '🐾'.repeat(n);
/** Ikony miestností kliniky (prízemie aj 2. poschodie). */
const CLINIC_ICONS: Record<ClinicRoomId, string> = {
  lab: '🔬',
  xray: '🩻',
  or: '🩺',
  ct: '🌀',
  pool: '🏊',
};
const ROOM_ICON: Record<Room, string> = {
  garage: '🏥',
  cafe: '☕',
  shelter: '🏠',
  clinic: '⚕️',
  catio: '🌳',
  hotel: '🏨',
  clinic2: '🏢',
  education: '🎓',
};
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
  private roomMenu = el('div', { class: 'room-menu', role: 'menu' });
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
  private modalKind: 'reports' | 'visitors' | 'menu' | 'welcome' | 'station' | null = null;
  /** Prístroj kliniky, pri ktorom hráč vyberá pacienta. */
  private stationRoom: ClinicRoomId = 'lab';
  private shopTab: ShopTab = 'build';
  /** Čo okno naposledy ukazovalo – pri prekreslení toho istého sa zachová posun. */
  private modalViewKey = '';
  private menuTab: MenuTab = 'challenges';
  private confirmReset = false;
  private selectedForVisit: string | null = null;
  private dev: DevMenu;
  private cafeWasOpen: boolean | null = null;

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
      playMinigame: (kind, extra) => void this.devMinigame(kind as MinigameKind, extra),
    });
    // Tajné: 5× rýchlo ťuknúť na hodiny otvorí vývojárske menu
    this.clockPill.addEventListener('pointerdown', () => this.dev.secretTap());
    // ★ v hornom paneli otvorí obchod s úrovňou útulku
    this.repPill.addEventListener('click', () => this.openMenu('shop'));
    this.repPill.style.cursor = 'pointer';
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
    this.root.classList.toggle('docked', l.docked);
    this.root.style.setProperty('--world-h', `${l.worldScreenH}px`);
    this.root.style.setProperty('--panel-w', `${l.panel.w}px`);
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
    this.roomBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const others = this.rooms.filter((r) => r !== this.game.room);
      // dve miestnosti = prepínač, tri = malá ponuka
      if (others.length === 1 && others[0]) this.game.showRoom(others[0]);
      else this.toggleRoomMenu(others);
    });
    document.addEventListener('click', () => this.roomMenu.remove());
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
    this.repPill.replaceChildren(`★ ${s.reputation}`, el('small', {}, ` · ${s.level + 1}`));
    this.setBadge(this.badges.reports, s.reports.length);
    this.setBadge(this.badges.visitors, s.adopters.length);
    this.setBadge(this.badges.menu, s.claimableChallenges + this.unseenPostcards);
    this.updateRoomButton();
    this.updateZuzka();
  }

  /** Miestnosti, ktoré má hráč postavené. */
  private get rooms(): Room[] {
    const s = this.state;
    return [
      'garage',
      ...(s.cafe.open ? ['cafe' as const] : []),
      ...(s.shelter.open ? ['shelter' as const] : []),
      ...(s.catio.open ? ['catio' as const] : []),
      ...(s.hotel.open ? ['hotel' as const] : []),
      ...(s.education.open ? ['education' as const] : []),
      ...(s.clinic.open ? ['clinic' as const] : []),
      ...(s.hasFloor2 ? ['clinic2' as const] : []),
    ];
  }

  private updateRoomButton(): void {
    const s = this.state;
    const room = this.game.room;
    const others = this.rooms.filter((r) => r !== room);
    this.roomBtn.hidden = others.length === 0;
    // pri dvoch miestnostiach ikona tej druhej, pri troch ikona aktuálnej (otvorí ponuku)
    const shown = others.length === 1 && others[0] ? others[0] : room;
    const label =
      others.length === 1 ? t(`UI_GO_${(others[0] ?? 'garage').toUpperCase()}`) : t('UI_ROOMS');
    if (this.roomBtn.title !== label || this.roomBtn.dataset.icon !== shown) {
      this.roomBtn.title = label;
      this.roomBtn.dataset.icon = shown;
      this.roomBtn.setAttribute('aria-label', label);
      this.roomBtn.replaceChildren(ROOM_ICON[shown], this.badges.room);
    }
    // Hostia čakajúci na obsluhu, kým je hráč inde ako v kaviarni
    // a školský výlet čakajúci na prednášku
    this.setBadge(
      this.badges.room,
      (room === 'cafe' ? 0 : s.waitingGuests.length) +
        (room !== 'education' && s.education.trip ? 1 : 0),
    );
  }

  private toggleRoomMenu(rooms: Room[]): void {
    if (this.roomMenu.isConnected) {
      this.roomMenu.remove();
      return;
    }
    this.roomMenu.replaceChildren(
      ...rooms.map((r) => {
        const waiting = r === 'cafe' ? this.state.waitingGuests.length : 0;
        return button(
          `${ROOM_ICON[r]} ${t(`UI_ROOM_${r.toUpperCase()}`)}${waiting ? ` (${waiting})` : ''}`,
          () => {
            this.roomMenu.remove();
            this.game.showRoom(r);
          },
        );
      }),
    );
    this.root.append(this.roomMenu);
  }

  /** Ťuknutie na prístroj kliniky: výber pacienta, alebo obchod, ak miestnosť ešte nie je. */
  openStation(room: ClinicRoomId): void {
    if (!this.state.hasClinicRoom(room)) {
      this.openShop();
      return;
    }
    this.stationRoom = room;
    this.openModal('station');
  }

  /** Prednáška pre školský výlet – kvíz (GDD §6.9). */
  startLecture(): void {
    void this.doLecture();
  }

  private async doLecture(): Promise<void> {
    const s = this.state;
    if (!s.education.trip) {
      this.toast(t('UI_NO_TRIP'));
      return;
    }
    const cat =
      s.residents[0] ?? s.cats[0] ?? generateCat(s.data, new Rng(3), { id: 'lecture-cat' });
    const stars = await this.runMinigame({ kind: 'quiz', cat, title: t('MG_QUIZ_TITLE') });
    if (stars === null) return;
    s.giveLecture(stars);
  }

  /** Otvorí obchod (napr. ťuknutím na plachtu nekúpenej miestnosti kliniky). */
  openShop(tab: ShopTab = 'build'): void {
    this.shopTab = tab;
    this.openMenu('shop');
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
    // Kaviareň v noci zatvára a ráno otvára (GDD §5.5)
    const open = this.state.cafeOpenNow;
    if (this.cafeWasOpen !== null && open !== this.cafeWasOpen && this.state.cafe.open) {
      this.toast(t(open ? 'TOAST_CAFE_MORNING' : 'TOAST_CAFE_NIGHT'));
      if (!this.selectedId && this.game.room === 'cafe') this.renderSheet();
    }
    this.cafeWasOpen = open;
    // Odpočet prestávok na karte aj prehľad miestnosti (hostia hotela, časy) – setSheet
    // mení DOM, iba keď sa obsah naozaj zmenil
    if (!this.busy) this.renderSheet();
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
        shelter: 'TOAST_SHELTER_OPEN',
        clinic: 'TOAST_CLINIC_OPEN',
        catio: 'TOAST_CATIO_OPEN',
        hotel: 'TOAST_HOTEL_OPEN',
        suite: 'TOAST_BOUGHT_SUITE',
        floor: 'TOAST_FLOOR_OPEN',
        education: 'TOAST_EDUCATION_OPEN',
      }[kind];
      this.toast(t(key));
      this.game.playSound('upgrade', 0.6);
      this.updateHud();
    });
    bus.on('hotelCheckIn', ({ cat }) => this.toast(t('TOAST_HOTEL_IN', { cat: cat.name })));
    bus.on('achievementUnlocked', ({ def }) => {
      this.toast(
        t('TOAST_ACHIEVEMENT', { name: t(`ACH_${def.id.toUpperCase()}`), money: def.money }),
      );
      this.game.playSound('success', 0.5);
      if (this.modalKind === 'menu' && this.menuTab === 'achievements') this.renderModal();
    });
    bus.on('tripArrived', ({ trip }) => {
      this.toast(t('TOAST_TRIP', { n: trip.kids.length }));
      this.game.playSound('notify', 0.5);
      this.updateHud();
    });
    bus.on('tripLeft', ({ stars, money, rep }) => {
      this.toast(
        stars > 0 ? t('TOAST_LECTURE_DONE', { money, rep }) : t('TOAST_TRIP_LEFT', { money }),
      );
      this.updateHud();
    });
    bus.on('hotelCheckOut', ({ cat, fee, rep }) => {
      this.toast(t(rep > 0 ? 'TOAST_HOTEL_OUT_STAR' : 'TOAST_HOTEL_OUT', { cat: cat.name, fee }));
      this.game.playSound(rep > 0 ? 'success' : 'notify', 0.5);
      if (this.selectedId === cat.id) this.renderSheet();
    });
    bus.on('clinicRoomBought', ({ room }) => {
      this.toast(t('TOAST_CLINIC_ROOM', { room: t(`CLINIC_${room.toUpperCase()}`) }));
      this.game.playSound('upgrade', 0.6);
      this.updateHud();
    });
    // Personál (GDD §6.4)
    bus.on('staffHired', ({ id }) => {
      const def = this.state.staffDef(id);
      if (def) this.toast(t('TOAST_STAFF_HIRED', { name: t(def.name_key) }));
      this.game.playSound('upgrade', 0.5);
    });
    bus.on('staffAction', ({ kind, cat, found }) => {
      if (kind === 'examine' && cat && found && found.length) {
        const names = found.map((id) =>
          t(this.state.data.conditions.find((d) => d.id === id)?.name_key ?? id),
        );
        this.toast(t('TOAST_VET_FOUND', { cat: cat.name, list: names.join(', ') }));
      }
    });
    // Úrovne, vybavenie a dekorácie (GDD §6.1)
    bus.on('levelUp', ({ def }) => {
      const list = def.unlocks.map((u) => t(`UNLOCK_${u.toUpperCase()}`)).join(', ');
      this.toast(t('TOAST_LEVEL_UP', { name: t(def.name_key), list }));
      this.game.playSound('upgrade', 0.6);
      this.game.playSound('mewPurr', 0.5);
      this.updateHud();
      if (this.modalKind === 'menu') this.renderModal();
    });
    bus.on('equipmentBought', ({ id }) => {
      const def = this.state.equipmentDef(id);
      if (def) this.toast(t('TOAST_BOUGHT', { name: t(def.name_key) }));
      this.game.playSound('upgrade', 0.5);
    });
    bus.on('decorBought', ({ def }) => {
      this.toast(t('TOAST_BOUGHT', { name: t(def.name_key) }));
      this.game.playSound('upgrade', 0.5);
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
    const status = cat.hotel
      ? el('span', { class: 'chip info' }, `🏨 ${t('UI_STATUS_HOTEL')}`)
      : cat.resident
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
      !cat.hotel &&
      (cat.conditions.some((c) => c.revealed && !c.treated) ||
        cat.examined.length < this.state.tools.length ||
        ready);
    const tabs: { id: CardTab; label: string; dot: boolean }[] = [
      {
        id: 'health',
        label: cat.hotel ? `🏨 ${t('TAB_STAY')}` : `🩺 ${t('TAB_HEALTH')}`,
        dot: needsHealth,
      },
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

    this.setSheet(head, stats, tabBar, el('div', { class: 'tab-body' }, ...body));
  }

  /**
   * Nahradí obsah karty, iba ak sa naozaj zmenil. Karta sa obnovuje každú pol sekundu –
   * keby sa tlačidlá stále menili, ťuknutie v nesprávnej chvíli by sa stratilo.
   */
  private setSheet(...nodes: (Node | string)[]): void {
    const tmp = document.createElement('div');
    tmp.append(...nodes);
    if (tmp.innerHTML === this.sheet.innerHTML) return;
    this.sheet.replaceChildren(...tmp.childNodes);
  }

  private defaultTab(cat: CatData): CardTab {
    if (cat.resident || cat.hotel) return 'care';
    return 'health';
  }

  /** Liečba: diagnózy, prehliadka; hotová mačka – adopcia alebo stálica. */
  private healthTab(cat: CatData, ready: boolean): HTMLElement[] {
    const s = this.state;
    const data = s.data;
    if (cat.resident) return [el('p', { class: 'hint' }, t('UI_RESIDENT_HINT'))];
    if (cat.hotel) return this.stayTab(cat);

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
      out.push(...this.shelterActions(cat), ...this.clinicActions(cat));
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
            s.treatmentRoom(c.id) && !s.hasClinicRoom(s.treatmentRoom(c.id) ?? 'or')
              ? el(
                  'span',
                  { class: 'chip lock' },
                  `🔒 ${t(s.treatmentRoom(c.id) === 'pool' ? 'UI_NEEDS_POOL' : 'UI_NEEDS_OR')}`,
                )
              : button(`🩹 ${t('UI_TREAT')}`, () => void this.doTreat(cat, c.id), {
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
      ['otoscope', '🔦', 'UI_TOOL_OTOSCOPE'],
      ['bloodtest', '🩸', 'UI_TOOL_BLOODTEST'],
      ['xray', '🩻', 'UI_TOOL_XRAY'],
      ['ct', '🌀', 'UI_TOOL_CT'],
    ];
    const pending = tools.filter(
      ([tool]) => s.tools.includes(tool) && !cat.examined.includes(tool),
    );
    if (pending.length > 0) {
      out.push(
        el(
          'div',
          { class: 'actions' },
          ...pending.map(([tool, icon, key]) =>
            button(`${icon} ${t(key)}`, () => void this.doExamine(cat, tool), {
              disabled: this.busy,
            }),
          ),
        ),
      );
    }
    out.push(...this.shelterActions(cat), ...this.clinicActions(cat));
    return out;
  }

  /** Klinika: kastrácia pred adopciou (GDD §6.5). */
  private clinicActions(cat: CatData): HTMLElement[] {
    const s = this.state;
    if (cat.resident || cat.hotel) return [];
    const out: HTMLElement[] = [];
    const chips: HTMLElement[] = [];
    if (cat.neutered) chips.push(el('span', { class: 'chip good' }, `✂️ ${t('UI_NEUTERED')}`));
    if (cat.rehabbed) chips.push(el('span', { class: 'chip good' }, `🏊 ${t('UI_REHABBED')}`));
    if (chips.length) out.push(el('div', { class: 'chips' }, ...chips));
    const buttons: HTMLElement[] = [];
    if (s.canNeuter(cat)) {
      out.push(el('p', { class: 'hint' }, t('UI_NEUTER_HINT')));
      buttons.push(
        button(`✂️ ${t('UI_NEUTER')}`, () => void this.doNeuter(cat), { disabled: this.busy }),
      );
    }
    if (s.canRehab(cat)) {
      out.push(el('p', { class: 'hint' }, t('UI_REHAB_HINT')));
      buttons.push(
        button(`🏊 ${t('UI_REHAB')}`, () => void this.doRehab(cat), { disabled: this.busy }),
      );
    }
    if (buttons.length) out.push(el('div', { class: 'actions' }, ...buttons));
    return out;
  }

  private async doRehab(cat: CatData): Promise<void> {
    const stars = await this.runMinigame({ kind: 'swim', cat, title: t('MG_REHAB_TITLE') });
    if (stars === null) return;
    if (this.state.rehab(cat.id)) {
      this.toast(t('TOAST_REHABBED', { cat: cat.name }));
      this.game.playSound('success', 0.5);
    }
  }

  private async doNeuter(cat: CatData): Promise<void> {
    const stars = await this.runMinigame({
      kind: 'surgery',
      cat,
      title: t('MG_NEUTER_TITLE'),
      neuter: true,
    });
    if (stars === null) return;
    if (this.state.neuter(cat.id)) {
      this.toast(t('TOAST_NEUTERED', { cat: cat.name }));
      this.game.playSound('success', 0.5);
    }
  }

  /** Útulok: očkovanie v ambulancii a presun medzi garážou a karanténou (GDD §6.2). */
  private shelterActions(cat: CatData): HTMLElement[] {
    const s = this.state;
    if (!s.shelter.open || cat.resident) return [];
    const buttons: HTMLElement[] = [];
    if (cat.vaccinated)
      buttons.push(el('span', { class: 'chip good' }, `💉 ${t('UI_VACCINATED')}`));
    else if (cat.conditions.every((c) => c.treated))
      buttons.push(
        button(`💉 ${t('UI_VACCINATE')}`, () => void this.doVaccinate(cat), {
          disabled: this.busy,
        }),
      );
    const inGarage = (cat.ward ?? 'garage') === 'garage';
    const to = inGarage ? 'quarantine' : 'garage';
    buttons.push(
      button(
        inGarage ? `🏠 ${t('UI_TO_QUARANTINE')}` : `🏥 ${t('UI_TO_GARAGE')}`,
        () => {
          if (s.moveCat(cat.id)) this.renderSheet();
        },
        { disabled: this.busy || s.freeIn(to) <= 0 },
      ),
    );
    return [el('div', { class: 'actions' }, ...buttons)];
  }

  private async doVaccinate(cat: CatData): Promise<void> {
    const stars = await this.runMinigame({ kind: 'vaccine', cat, title: t('MG_VACCINE_TITLE') });
    if (stars === null) return;
    if (this.state.vaccinate(cat.id)) {
      this.toast(t('TOAST_VACCINATED', { cat: cat.name }));
      this.game.playSound('success', 0.5);
    }
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
      cat.clinicCase ? el('p', { class: 'hint' }, `💗 ${t('UI_CLINIC_CASE')}`) : el('span'),
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
    if (this.game.room === 'shelter') {
      this.renderShelterPanel();
      return;
    }
    if (this.game.room === 'clinic') {
      this.renderClinicPanel();
      return;
    }
    if (this.game.room === 'clinic2') {
      this.renderClinic2Panel();
      return;
    }
    if (this.game.room === 'education') {
      this.renderEducationPanel();
      return;
    }
    if (this.game.room === 'catio') {
      this.renderCatioPanel();
      return;
    }
    if (this.game.room === 'hotel') {
      this.renderHotelPanel();
      return;
    }
    const s = this.state;
    // V garáži sú pacienti z garáže; stálice iba dovtedy, kým nie je kaviareň
    const cats = [...s.wardCats('garage'), ...(s.cafe.open ? [] : s.residents)];
    this.setSheet(
      el('h2', {}, `🚑 ${t('UI_GARAGE')}`),
      el(
        'p',
        { class: 'hint' },
        [
          t('UI_GARAGE_LINE', { free: s.freeIn('garage'), total: s.cageCount }),
          s.cafe.open ? '' : t('UI_RESIDENTS', { n: s.residents.length, max: s.residentSlots }),
          s.shelter.open
            ? t('UI_QUARANTINE_SHORT', { free: s.freeIn('quarantine'), total: s.quarantineCages })
            : '',
        ]
          .filter(Boolean)
          .join(' · '),
      ),
      cats.length
        ? el('div', { class: 'cat-list' }, ...cats.map((cat) => this.catTile(cat)))
        : el('p', { class: 'muted' }, t('UI_GARAGE_EMPTY')),
      cats.length ? el('p', { class: 'hint' }, t('UI_TAP_CAT')) : '',
      this.staffHere('garage'),
      this.panelButtons(),
    );
  }

  /** Personál, ktorý práve pracuje v danej miestnosti (GDD §6.4). */
  private staffHere(room: Room): HTMLElement | string {
    const s = this.state;
    const names = s.data.staff
      .filter((d) => s.staffWorking(d.id))
      .filter((d) => this.staffRoom(d.id, d.room) === room)
      .map((d) => `${d.icon} ${t(d.name_key)}`);
    return names.length
      ? el('p', { class: 'hint' }, t('UI_STAFF_HERE', { names: names.join(', ') }))
      : '';
  }

  /** Kde člen tímu práve pracuje (veterinárka sa sťahuje s útulkom a klinikou). */
  private staffRoom(id: string, room: Room): Room {
    const s = this.state;
    if (id !== 'vet') return room;
    if (s.hasClinicRoom('lab') || s.hasClinicRoom('xray')) return 'clinic';
    return s.shelter.open ? 'shelter' : 'garage';
  }

  /** Hlásenia a záujemcovia – rýchly prístup z prehľadu miestnosti. */
  private panelButtons(): HTMLElement | string {
    const s = this.state;
    const btns = [
      s.reports.length > 0
        ? button(`📋 ${t('UI_REPORTS')} (${s.reports.length})`, () => this.openModal('reports'), {
            class: 'btn primary',
          })
        : null,
      s.adopters.length > 0
        ? button(`🚪 ${t('UI_VISITORS')} (${s.adopters.length})`, () => this.openModal('visitors'))
        : null,
    ].filter((b): b is HTMLButtonElement => !!b);
    return btns.length ? el('div', { class: 'actions' }, ...btns) : '';
  }

  /** Panel útulku: pacienti v karanténe a voľné miesta (GDD §6.2). */
  private renderShelterPanel(): void {
    const s = this.state;
    const tiles = s.wardCats('quarantine').map((cat) => this.catTile(cat));
    this.setSheet(
      el('h2', {}, `🏠 ${t('UI_SHELTER')}`),
      el(
        'p',
        { class: 'hint' },
        t('UI_QUARANTINE_LINE', {
          free: s.freeIn('quarantine'),
          total: s.quarantineCages,
          g: s.freeIn('garage'),
          gt: s.cageCount,
        }),
      ),
      tiles.length
        ? el('div', { class: 'cat-list' }, ...tiles)
        : el('p', { class: 'muted' }, t('UI_SHELTER_EMPTY')),
      this.staffHere('shelter'),
      this.panelButtons(),
    );
  }

  /** Panel kliniky: miestnosti a mačky, ktoré tu niečo čaká (GDD §6.5). */
  private renderClinicPanel(): void {
    const s = this.state;
    const roomLine = (['lab', 'xray', 'or'] as const)
      .map((r) => `${s.hasClinicRoom(r) ? '✓' : '🔒'} ${t(`CLINIC_${r.toUpperCase()}`)}`)
      .join(' · ');
    // pacienti, ktorým klinika pomôže: prehliadka novým nástrojom, operácia, dlaha, kastrácia
    const clinicTools = s.tools.filter((x) => x === 'bloodtest' || x === 'xray');
    const waiting = s.cats.filter(
      (c) =>
        !c.resident &&
        (clinicTools.some((x) => !c.examined.includes(x)) ||
          c.conditions.some((x) => {
            const def = s.data.conditions.find((d) => d.id === x.id);
            return x.revealed && !x.treated && !!def?.clinic;
          }) ||
          s.canNeuter(c)),
    );
    const missing = (['lab', 'xray', 'or'] as const).filter((r) => !s.hasClinicRoom(r));
    this.setSheet(
      el('h2', {}, `⚕️ ${t('UI_ROOM_CLINIC')}`),
      el('p', { class: 'hint' }, roomLine),
      waiting.length
        ? el('div', { class: 'cat-list' }, ...waiting.map((cat) => this.catTile(cat)))
        : el('p', { class: 'muted' }, t('UI_CLINIC_EMPTY')),
      el('p', { class: 'hint' }, t('UI_CLINIC_TAP')),
      this.staffHere('clinic'),
      missing.length
        ? button(`🛒 ${t('UI_CLINIC_BUY_ROOMS')}`, () => this.openShop(), { class: 'btn' })
        : '',
      this.panelButtons(),
    );
  }

  /** Panel hotela: hostia, kedy odchádzajú a ako sú spokojní (GDD §6.7). */
  private renderHotelPanel(): void {
    const s = this.state;
    const guests = s.hotel.guests;
    this.setSheet(
      el('h2', {}, `🏨 ${t('UI_HOTEL')}`),
      el('p', { class: 'hint' }, t('UI_HOTEL_LINE', { n: guests.length, max: s.suiteCount })),
      guests.length
        ? el('div', { class: 'cat-list' }, ...guests.map((cat) => this.catTile(cat)))
        : el(
            'p',
            { class: 'muted' },
            t(s.dayPhase === 'night' ? 'UI_HOTEL_NIGHT' : 'UI_HOTEL_EMPTY'),
          ),
      el('p', { class: 'hint' }, t('UI_HOTEL_HINT', { at: s.data.balance.hotel.happy_at })),
      this.panelButtons(),
    );
  }

  /** Panel výbehu: kto je práve vonku (GDD §6.6). */
  private renderCatioPanel(): void {
    const s = this.state;
    const outside = this.game.catsOutside();
    const cats = s.residents.filter((c) => outside.includes(c.id));
    const night = s.dayPhase === 'night';
    this.setSheet(
      el('h2', {}, `🌳 ${t('UI_CATIO')}`),
      el('p', { class: 'hint' }, t('UI_CATIO_LINE', { n: cats.length, all: s.residents.length })),
      cats.length
        ? el('div', { class: 'cat-list' }, ...cats.map((cat) => this.catTile(cat)))
        : el(
            'p',
            { class: 'muted' },
            t(night ? 'UI_CATIO_NIGHT' : s.residents.length ? 'UI_CATIO_INSIDE' : 'UI_CATIO_NONE'),
          ),
      el('p', { class: 'hint' }, t('UI_CATIO_HINT')),
      this.panelButtons(),
    );
  }

  /** Panel edukačného centra: čakajúci výlet a prednáška (GDD §6.9). */
  private renderEducationPanel(): void {
    const s = this.state;
    const trip = s.education.trip;
    const e = s.data.balance.education;
    const body: (HTMLElement | string)[] = trip
      ? [
          el(
            'div',
            { class: 'guest' },
            personPortrait(trip.teacher, 1.25),
            el(
              'span',
              { class: 'grow' },
              t('UI_TRIP_LINE', {
                n: trip.kids.length,
                min: Math.max(1, Math.ceil((trip.leaveAt - s.now) / 60_000)),
              }),
            ),
          ),
          button(`🎓 ${t('UI_LECTURE')}`, () => this.startLecture(), {
            class: 'btn primary',
            disabled: this.busy,
          }),
          el(
            'p',
            { class: 'hint' },
            t('UI_LECTURE_HINT', { money: trip.kids.length * e.donation_per_kid }),
          ),
        ]
      : [
          el(
            'p',
            { class: 'muted' },
            t(
              s.dayPhase === 'night' || s.dayPhase === 'evening' ? 'UI_TRIP_NIGHT' : 'UI_TRIP_NONE',
            ),
          ),
        ];
    this.setSheet(
      el('h2', {}, `🎓 ${t('UI_EDUCATION')}`),
      el('p', { class: 'hint' }, t('UI_EDUCATION_LINE', { n: s.counters.lectures })),
      ...body,
      this.panelButtons(),
    );
  }

  /** Panel 2. poschodia kliniky: CT a bazén (GDD §6.8). */
  private renderClinic2Panel(): void {
    const s = this.state;
    const roomLine = (['ct', 'pool'] as const)
      .map((r) => `${s.hasClinicRoom(r) ? '✓' : '🔒'} ${t(`CLINIC_${r.toUpperCase()}`)}`)
      .join(' · ');
    const waiting = s.cats.filter(
      (c) =>
        !c.resident &&
        ((s.hasClinicRoom('ct') && !c.examined.includes('ct')) ||
          c.conditions.some((x) => x.revealed && !x.treated && x.id === 'spine') ||
          s.canRehab(c)),
    );
    this.setSheet(
      el('h2', {}, `🏢 ${t('UI_ROOM_CLINIC2')}`),
      el('p', { class: 'hint' }, roomLine),
      waiting.length
        ? el('div', { class: 'cat-list' }, ...waiting.map((cat) => this.catTile(cat)))
        : el('p', { class: 'muted' }, t('UI_CLINIC_EMPTY')),
      el('p', { class: 'hint' }, t('UI_CLINIC2_TAP')),
      (['ct', 'pool'] as const).some((r) => !s.hasClinicRoom(r))
        ? button(`🛒 ${t('UI_CLINIC_BUY_ROOMS')}`, () => this.openShop(), { class: 'btn' })
        : '',
      this.panelButtons(),
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
    this.setSheet(
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
          ? el('p', { class: 'muted' }, t(s.cafeOpenNow ? 'UI_CAFE_NO_GUESTS' : 'UI_CAFE_CLOSED'))
          : el('div', { class: 'guests' }, ...rows),
      residents.length ? el('div', { class: 'cat-list' }, ...residents) : '',
      this.staffHere('cafe'),
      this.panelButtons(),
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
        this.needIcons(cat),
        el('br'),
        el(
          'small',
          {},
          cat.hotel
            ? t('UI_HOTEL_TILE', {
                min: this.minutesLeft(cat),
                happy: Math.round(s.hotelHappiness(cat)),
              })
            : cat.resident
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

  /** Minúty do odchodu hosťa hotela (aspoň 1). */
  private minutesLeft(cat: CatData): number {
    return Math.max(1, Math.ceil(((cat.hotel?.checkoutAt ?? 0) - this.state.now) / 60_000));
  }

  /** Pobyt v hoteli: majiteľ, odchod, spokojnosť a koľko zaplatí (GDD §6.7). */
  private stayTab(cat: CatData): HTMLElement[] {
    const s = this.state;
    const happy = Math.round(s.hotelHappiness(cat));
    const h = s.data.balance.hotel;
    return [
      el(
        'div',
        { class: 'guest' },
        personPortrait(cat.hotel?.owner ?? '005', 1.25),
        el(
          'span',
          { class: 'grow' },
          t('UI_HOTEL_STAY_LINE', { min: this.minutesLeft(cat), fee: s.hotelFee(cat) }),
        ),
      ),
      el(
        'div',
        { class: 'stat' },
        el('span', {}, t('UI_HOTEL_HAPPY')),
        el('span', { class: 'val' }, `${happy} %`),
        el(
          'div',
          { class: 'bar' },
          el('i', {
            style: `width:${happy}%;background:${happy >= h.happy_at ? 'var(--ui-good)' : 'var(--ui-warn)'}`,
          }),
        ),
      ),
      el('p', { class: 'hint' }, t('UI_HOTEL_HINT', { at: h.happy_at })),
    ];
  }

  /** Čo mačka práve potrebuje – malé ikonky na dlaždici v prehľade. */
  private needIcons(cat: CatData): HTMLElement | string {
    const s = this.state;
    const needs: [string, string][] = [];
    if (!cat.resident) {
      if (cat.conditions.some((c) => c.revealed && !c.treated))
        needs.push(['💊', t('UI_NEED_TREAT')]);
      if (cat.examined.length < s.tools.length) needs.push(['🔍', t('UI_NEED_EXAMINE')]);
    }
    if (cat.stats.satisfaction < 40) needs.push(['🍽️', t('UI_NEED_FOOD')]);
    if (cat.stats.cleanliness < 40) needs.push(['🛁', t('UI_NEED_CLEAN')]);
    if (!needs.length) return '';
    return el(
      'span',
      { class: 'needs', title: needs.map((n) => n[1]).join(', ') },
      ...needs.map((n) => n[0]),
    );
  }

  // ---------- Akcie ----------

  private async doExamine(cat: CatData, tool: DiagnosticTool): Promise<void> {
    // Krvný test a röntgen majú vlastnú minihru (GDD §6.5)
    if (tool === 'bloodtest' || tool === 'xray' || tool === 'ct') {
      const hidden = cat.conditions.find(
        (c) =>
          !c.revealed &&
          this.state.data.conditions.find((d) => d.id === c.id)?.reveal_tool === 'xray',
      );
      const stars = await this.runMinigame({
        kind: tool,
        cat,
        title: t(
          tool === 'xray' ? 'MG_XRAY_TITLE' : tool === 'ct' ? 'MG_CT_TITLE' : 'MG_BLOOD_TITLE',
        ),
        xray: hidden ? (hidden.id as 'fracture' | 'swallowed') : null,
      });
      if (stars === null) return;
    }
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

  /** Vývojárske menu: minihra na vybranej (alebo prvej, alebo vymyslenej) mačke, bez účinku. */
  private async devMinigame(
    kind: MinigameKind,
    extra: { xray?: 'fracture' | 'swallowed' | null; neuter?: boolean } = {},
  ): Promise<void> {
    const s = this.state;
    const cat =
      (this.selectedId ? s.getCat(this.selectedId) : undefined) ??
      s.cats[0] ??
      generateCat(s.data, new Rng(7), { id: 'dev-cat' });
    const titles: Partial<Record<MinigameKind, string>> = {
      tick_removal: 'MG_TICK_TITLE',
      bandage: 'HOLD_BANDAGE',
      ears: 'HOLD_EAR',
      syrup: 'HOLD_SYRUP',
      breath: 'MG_BREATH_TITLE',
      bath: 'MG_BATH_TITLE',
      claws: 'MG_CLAWS_TITLE',
      drops: 'MG_DROPS_TITLE',
      vaccine: 'MG_VACCINE_TITLE',
      feather: 'MG_FEATHER_TITLE',
      hold: 'HOLD_BRUSH',
      quiet: 'ACT_SIT_QUIETLY',
      bloodtest: 'MG_BLOOD_TITLE',
      xray: 'MG_XRAY_TITLE',
      surgery: extra.neuter ? 'MG_NEUTER_TITLE' : 'MG_SURGERY_TITLE',
      splint: 'MG_SPLINT_TITLE',
      ct: 'MG_CT_TITLE',
      swim: 'MG_SWIM_TITLE',
      quiz: 'MG_QUIZ_TITLE',
    };
    const title = t(titles[kind] ?? kind);
    const stars = await this.runMinigame({ kind, cat, title, ...extra });
    this.toast(stars === null ? '🛠 Zrušené' : `🛠 ${title}: ${'★'.repeat(stars)}`);
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
      case 'station':
        box.append(...this.stationContent(), closeBtn);
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
    // Po kúpe sa okno prekreslí – zostaň tam, kde hráč bol (nehádž ho hore)
    const key = `${this.modalKind}:${this.menuTab}:${this.shopTab}:${this.stationRoom}`;
    const scroll =
      key === this.modalViewKey ? (this.modal.querySelector('.modal-box')?.scrollTop ?? 0) : 0;
    this.modalViewKey = key;
    this.modal.replaceChildren(box);
    box.scrollTop = scroll;
  }

  /** Pacienti, ktorým pomôže tento prístroj kliniky (GDD §6.5). */
  private stationContent(): HTMLElement[] {
    const s = this.state;
    const room = this.stationRoom;
    const icons = CLINIC_ICONS;
    const go = (run: () => void) => () => {
      this.closeModal();
      run();
    };
    const rows: HTMLElement[] = [];
    for (const cat of s.cats) {
      if (cat.resident) continue;
      const actions: HTMLElement[] = [];
      if (room === 'lab' && !cat.examined.includes('bloodtest'))
        actions.push(
          button(
            `🩸 ${t('UI_TOOL_BLOODTEST')}`,
            go(() => void this.doExamine(cat, 'bloodtest')),
            {
              class: 'btn primary',
            },
          ),
        );
      if (room === 'xray' && !cat.examined.includes('xray'))
        actions.push(
          button(
            `🩻 ${t('UI_TOOL_XRAY')}`,
            go(() => void this.doExamine(cat, 'xray')),
            {
              class: 'btn primary',
            },
          ),
        );
      if (room === 'ct' && !cat.examined.includes('ct'))
        actions.push(
          button(
            `🌀 ${t('UI_TOOL_CT')}`,
            go(() => void this.doExamine(cat, 'ct')),
            {
              class: 'btn primary',
            },
          ),
        );
      if (room === 'pool') {
        for (const c of cat.conditions) {
          const def = s.data.conditions.find((d) => d.id === c.id);
          if (!c.revealed || c.treated || def?.minigame !== 'swim') continue;
          actions.push(
            button(
              `🩹 ${t(def.name_key)}`,
              go(() => void this.doTreat(cat, c.id)),
              {
                class: 'btn primary',
              },
            ),
          );
        }
        if (s.canRehab(cat))
          actions.push(
            button(
              `🏊 ${t('UI_REHAB')}`,
              go(() => void this.doRehab(cat)),
            ),
          );
      }
      if (room === 'or') {
        for (const c of cat.conditions) {
          const def = s.data.conditions.find((d) => d.id === c.id);
          if (
            !c.revealed ||
            c.treated ||
            (def?.minigame !== 'surgery' && def?.minigame !== 'splint')
          )
            continue;
          actions.push(
            button(
              `🩹 ${t(def.name_key)}`,
              go(() => void this.doTreat(cat, c.id)),
              {
                class: 'btn primary',
              },
            ),
          );
        }
        if (s.canNeuter(cat))
          actions.push(
            button(
              `✂️ ${t('UI_NEUTER')}`,
              go(() => void this.doNeuter(cat)),
            ),
          );
      }
      if (!actions.length) continue;
      rows.push(
        el(
          'div',
          { class: 'station-row' },
          catPortrait(cat, 1.5),
          el('strong', { class: 'grow' }, cat.name),
          el('div', { class: 'actions' }, ...actions),
        ),
      );
    }
    return [
      el('h2', {}, `${icons[room]} ${t(`CLINIC_${room.toUpperCase()}`)}`),
      el('p', { class: 'hint' }, t(`CLINIC_${room.toUpperCase()}_DESC`)),
      ...(rows.length ? rows : [el('p', { class: 'muted' }, t('UI_STATION_EMPTY'))]),
    ];
  }

  private reportsContent(): HTMLElement[] {
    const s = this.state;
    const out: HTMLElement[] = [
      el('h2', {}, t('UI_REPORTS')),
      el('p', { class: 'hint' }, t('UI_FREE_CAGES', { free: s.freeCages, total: s.totalCages })),
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
            def.family ? ` · ${t('UI_FAMILY_NEEDS', { n: s.cagesNeeded(r.id) })}` : '',
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
              { class: 'btn primary', disabled: s.freeCages < s.cagesNeeded(r.id) },
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
    const tabs: { id: MenuTab; icon: string; label: string; badge: number }[] = [
      {
        id: 'challenges',
        icon: '🎯',
        label: t('MENU_CHALLENGES'),
        badge: this.state.claimableChallenges,
      },
      { id: 'achievements', icon: '🏆', label: t('MENU_ACHIEVEMENTS'), badge: 0 },
      { id: 'album', icon: '📖', label: t('MENU_ALBUM'), badge: 0 },
      { id: 'postcards', icon: '💌', label: t('MENU_POSTCARDS'), badge: this.unseenPostcards },
      { id: 'shop', icon: '🛒', label: t('MENU_SHOP'), badge: 0 },
      { id: 'more', icon: '⚙️', label: '', badge: 0 },
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
        el('span', { class: 'tab-ico' }, tb.icon),
        tb.label ? el('span', { class: 'tab-txt' }, ` ${tb.label}`) : '',
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
        : this.menuTab === 'achievements'
          ? this.achievementsContent()
          : this.menuTab === 'album'
            ? this.albumContent()
            : this.menuTab === 'postcards'
              ? this.postcardsContent()
              : this.menuTab === 'shop'
                ? this.shopContent()
                : this.moreContent();
    return [bar, ...body];
  }

  /** Úspechy: odomknuté navrchu, ostatné s postupom (GDD §7.5). */
  private achievementsContent(): HTMLElement[] {
    const s = this.state;
    const defs = [...s.data.achievements].sort(
      (a, b) =>
        Number(s.achievements[b.id] !== undefined) - Number(s.achievements[a.id] !== undefined),
    );
    return [
      el(
        'p',
        { class: 'hint' },
        t('UI_ACH_LINE', { n: s.achievementCount, total: s.data.achievements.length }),
      ),
      ...defs.map((def) => {
        const done = s.achievements[def.id] !== undefined;
        const p = s.achievementProgress(def);
        return el(
          'div',
          { class: `achievement${done ? ' done' : ''}` },
          el('span', { class: 'shop-icon' }, done ? def.icon : '🔒'),
          el(
            'div',
            { class: 'grow' },
            el('strong', {}, t(`ACH_${def.id.toUpperCase()}`)),
            el(
              'p',
              { class: 'hint' },
              t(
                p.need === 1 &&
                  t(`ACHD_${def.kind.toUpperCase()}_1`) !== `ACHD_${def.kind.toUpperCase()}_1`
                  ? `ACHD_${def.kind.toUpperCase()}_1`
                  : `ACHD_${def.kind.toUpperCase()}`,
                { n: p.need },
              ),
            ),
            done
              ? ''
              : el(
                  'div',
                  { class: 'bar' },
                  el('i', {
                    style: `width:${Math.round((p.have / p.need) * 100)}%;background:#f2c14e`,
                  }),
                ),
          ),
          el(
            'span',
            { class: done ? 'chip good' : 'chip' },
            done ? '✓' : `${p.have}/${p.need} · ${t('UI_ACH_REWARD', { money: def.money })}`,
          ),
        );
      }),
    ];
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
    const filled = s.albumFilled;
    const grid = el('div', { class: 'album' });
    const regular = data.coats.filter((c) => !c.special);
    // Bežné plemená majú riadok, plemená s pevnou farbou sú spolu v jednom riadku na konci
    const ordered = [...data.breeds.filter((b) => !b.coat), ...data.breeds.filter((b) => b.coat)];
    let specialHeader = false;
    for (const breed of ordered) {
      if (!breed.coat) grid.append(el('div', { class: 'album-breed' }, t(breed.name_key)));
      else if (!specialHeader) {
        specialHeader = true;
        grid.append(el('div', { class: 'album-breed' }, t('UI_ALBUM_FIXED')));
      }
      const fixed = data.coats.find((c) => c.id === breed.coat);
      for (const coat of fixed ? [fixed] : regular) {
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
            `${t(entry.how === 'adopted' ? 'UI_ALBUM_ADOPTED' : 'UI_ALBUM_RESIDENT', { cat: entry.name })} (${label})`,
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

  /** Obchod: úroveň útulku, rozšírenie, vybavenie a dekorácie (GDD §6.1). */
  private shopContent(): HTMLElement[] {
    const s = this.state;
    const cagePrice = s.nextCagePrice;
    const slotPrice = s.nextSlotPrice;
    const buy = (label: string, price: number, run: () => boolean) =>
      button(
        label,
        () => {
          if (run()) this.renderModal();
        },
        { class: 'btn primary', disabled: s.money < price },
      );
    const lockChip = (rep: number | null) =>
      el('span', { class: 'chip lock' }, t('UI_LOCKED', { rep: rep ?? '?' }));

    // Úroveň útulku
    const lvl = s.levelDef;
    const next = s.nextLevelDef;
    const from = lvl?.rep ?? 0;
    const pct = next ? Math.min(100, ((s.reputation - from) / (next.rep - from)) * 100) : 100;
    const levelCard = el(
      'div',
      { class: 'level-card' },
      el(
        'div',
        { class: 'row' },
        el('strong', {}, `★ ${t('UI_LEVEL', { n: s.level + 1, name: t(lvl?.name_key ?? '') })}`),
        el(
          'span',
          { class: 'muted' },
          next ? `${s.reputation} / ${next.rep} ★` : `${s.reputation} ★`,
        ),
      ),
      el('div', { class: 'bar' }, el('i', { style: `width:${pct}%;background:#f2c14e` })),
      el(
        'p',
        { class: 'hint' },
        next
          ? `${t('UI_NEXT_LEVEL', { name: t(next.name_key) })} ${next.unlocks.map((u) => t(`UNLOCK_${u.toUpperCase()}`)).join(', ')}`
          : t('UI_MAX_LEVEL'),
      ),
    );

    // Rozšírenie
    const expand: HTMLElement[] = [
      el(
        'div',
        { class: 'upgrade' },
        el('strong', {}, `🐈 ${t('UI_CAGES', { n: s.cageCount })}`),
        cagePrice === null
          ? el('span', { class: 'muted' }, t('UI_MAXED'))
          : buy(t('UI_BUY_CAGE', { price: cagePrice }), cagePrice, () => s.buyCage()),
      ),
      el(
        'div',
        { class: 'upgrade' },
        el('strong', {}, `🛋️ ${t('UI_SLOTS', { n: s.residentSlots })}`),
        slotPrice === null
          ? el('span', { class: 'muted' }, t('UI_MAXED'))
          : buy(t('UI_BUY_SLOT', { price: slotPrice }), slotPrice, () => s.buySlot()),
      ),
      this.cafeUpgrade(),
      this.catioUpgrade(),
      ...this.hotelUpgrade(),
      this.educationUpgrade(),
      this.shelterUpgrade(),
      ...this.clinicUpgrade(),
    ];

    // Vybavenie
    const equipment = s.data.equipment.map((def) => {
      const level = s.equipmentLevel(def.id);
      const price = s.nextEquipmentPrice(def.id);
      const unlock = s.nextEquipmentUnlock(def.id);
      const locked = unlock !== null && !s.hasUnlock(unlock);
      const pips = '●'.repeat(level) + '○'.repeat(def.prices.length - level);
      return el(
        'div',
        { class: 'shop-item' },
        el('span', { class: 'shop-icon' }, def.icon),
        el(
          'div',
          { class: 'grow' },
          el('strong', {}, t(def.name_key), ' ', el('span', { class: 'pips' }, pips)),
          el('p', { class: 'hint' }, t(def.desc_key)),
        ),
        price === null
          ? el('span', { class: 'chip good' }, t('UI_EQ_MAX'))
          : locked
            ? lockChip(unlock ? s.unlockRep(unlock) : null)
            : buy(`${price} €`, price, () => s.buyEquipment(def.id)),
      );
    });

    // Dekorácie
    const gc = s.coziness('garage');
    const cc = s.coziness('cafe');
    const cz = s.data.balance.coziness;
    const decor = (['garage', 'cafe'] as const).flatMap((room) => [
      el('h3', {}, t(room === 'garage' ? 'UI_DECOR_GARAGE' : 'UI_DECOR_CAFE')),
      ...s.data.decor
        .filter((d) => d.room === room)
        .map((def) => {
          const owned = s.decor.includes(def.id);
          const locked = def.unlock !== undefined && !s.hasUnlock(def.unlock);
          return el(
            'div',
            { class: 'shop-item' },
            el('span', { class: 'shop-icon' }, decorPreview(def)),
            el(
              'div',
              { class: 'grow' },
              el('strong', {}, t(def.name_key)),
              el('p', { class: 'hint' }, `❤ +${def.cozy}`),
            ),
            owned
              ? el('span', { class: 'chip good' }, '✓')
              : locked
                ? lockChip(def.unlock ? s.unlockRep(def.unlock) : null)
                : room === 'cafe' && !s.cafe.open
                  ? el('span', { class: 'chip lock' }, t('UI_CAFE_NEEDED'))
                  : buy(`${def.price} €`, def.price, () => s.buyDecor(def.id)),
          );
        }),
    ]);

    const tabs: { id: ShopTab; label: string }[] = [
      { id: 'build', label: `🏗️ ${t('UI_SHOP_BUILD')}` },
      { id: 'equipment', label: `🧰 ${t('UI_SHOP_EQUIP')}` },
      { id: 'staff', label: `👩‍⚕️ ${t('UI_SECTION_STAFF')}` },
      { id: 'decor', label: `🪴 ${t('UI_SECTION_DECOR')}` },
    ];
    const bar = el('div', { class: 'tabs shop-tabs', role: 'tablist' });
    for (const tb of tabs) {
      const b = el(
        'button',
        {
          class: `tab${this.shopTab === tb.id ? ' active' : ''}`,
          type: 'button',
          role: 'tab',
          'aria-selected': this.shopTab === tb.id ? 'true' : 'false',
        },
        tb.label,
      );
      b.addEventListener('click', () => {
        this.shopTab = tb.id;
        this.renderModal();
      });
      bar.append(b);
    }
    if (this.shopTab === 'build') return [levelCard, bar, ...expand];
    if (this.shopTab === 'equipment') return [levelCard, bar, ...equipment];
    if (this.shopTab === 'staff') return [levelCard, bar, ...this.staffSection().slice(1)];
    return [
      levelCard,
      bar,
      el(
        'p',
        { class: 'hint' },
        t('UI_COZY_LINE', {
          g: gc,
          gp: Math.round(gc * cz.garage_trust_per_point * 100),
          c: cc,
          cp: Math.round(cc * cz.cafe_tip_per_point * 100),
        }),
      ),
      ...decor,
    ];
  }

  /** Viac: štatistiky, zvuk, nová hra. */
  private moreContent(): HTMLElement[] {
    const s = this.state;
    const out: HTMLElement[] = [
      el(
        'p',
        { class: 'hint' },
        t('UI_STATS_LINE', { r: s.counters.rescued, a: s.counters.adopted }),
      ),
      button(this.muted ? `🔇 ${t('UI_SOUND_OFF')}` : `🔊 ${t('UI_SOUND_ON')}`, () =>
        this.toggleMute(),
      ),
      el(
        'div',
        { class: 'actions' },
        ...(['sk', 'en'] as const).map((l) =>
          button(
            l === 'sk' ? '🇸🇰 Slovenčina' : '🇬🇧 English',
            () => {
              if (l === lang) return;
              setLang(l);
              this.game.saveNow();
              location.reload();
            },
            { class: l === lang ? 'btn primary' : 'btn' },
          ),
        ),
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

  /** Personál: najať raz, potom zapínať a vypínať (GDD §6.4). */
  private staffSection(): HTMLElement[] {
    const s = this.state;
    const rows = s.data.staff.map((def) => {
      const hired = s.isHired(def.id);
      let action: HTMLElement;
      if (hired) {
        const on = s.staff[def.id]?.active ?? false;
        action = button(
          on ? `✓ ${t('UI_STAFF_ON')}` : t('UI_STAFF_OFF'),
          () => {
            s.setStaffActive(def.id, !on);
            this.renderModal();
          },
          { class: on ? 'btn primary' : 'btn', 'aria-pressed': on ? 'true' : 'false' },
        );
      } else if (!s.hasUnlock('staff')) {
        action = el(
          'span',
          { class: 'chip lock' },
          t('UI_LOCKED', { rep: s.unlockRep('staff') ?? '?' }),
        );
      } else if (def.requires === 'cafe' && !s.cafe.open) {
        action = el('span', { class: 'chip lock' }, t('UI_STAFF_NEEDS_CAFE'));
      } else {
        action = button(
          t('UI_STAFF_HIRE', { price: def.price }),
          () => {
            if (s.hireStaff(def.id)) this.renderModal();
          },
          { class: 'btn primary', disabled: s.money < def.price },
        );
      }
      return el(
        'div',
        { class: 'shop-item' },
        el('span', { class: 'shop-icon' }, personPortrait(def.sprite, 1)),
        el(
          'div',
          { class: 'grow' },
          el('strong', {}, `${def.icon} ${t(def.name_key)}`),
          el('p', { class: 'hint' }, t(def.desc_key)),
        ),
        action,
      );
    });
    return [
      el('h3', {}, t('UI_SECTION_STAFF')),
      el('p', { class: 'hint' }, t('UI_STAFF_HINT')),
      ...rows,
    ];
  }

  /** Komunitný útulok – Fáza 2 (GDD §6.2). */
  private shelterUpgrade(): HTMLElement {
    const s = this.state;
    const b = s.data.balance.shelter;
    if (s.shelter.open)
      return el(
        'div',
        { class: 'upgrade' },
        el('strong', {}, `🏠 ${t('UI_SHELTER')}`),
        el('span', { class: 'chip good' }, '✓'),
      );
    const miss = s.shelterMissing;
    const locks: HTMLElement[] = [];
    if (miss.rep > 0)
      locks.push(
        el(
          'span',
          { class: 'chip lock' },
          t('UI_LOCKED', { rep: s.unlockRep('shelter_2') ?? '?' }),
        ),
      );
    if (miss.rescued > 0)
      locks.push(
        el(
          'span',
          { class: 'chip lock' },
          t('UI_NEED_RESCUED', { n: b.min_rescued, have: s.counters.rescued }),
        ),
      );
    return el(
      'div',
      { class: 'upgrade cafe' },
      el(
        'div',
        {},
        el('strong', {}, `🏠 ${t('UI_SHELTER')}`),
        el('p', { class: 'hint' }, t('UI_SHELTER_DESC', { cages: b.quarantine_cages })),
      ),
      locks.length
        ? el('div', { class: 'locks' }, ...locks)
        : button(
            t('UI_BUY_SHELTER', { price: b.price }),
            () => {
              if (s.buyShelter()) this.closeModal();
            },
            { class: 'btn primary', disabled: s.money < b.price },
          ),
    );
  }

  /** Edukačné centrum (GDD §6.9). */
  private educationUpgrade(): HTMLElement {
    const s = this.state;
    const price = s.data.balance.education.price;
    if (s.education.open)
      return el(
        'div',
        { class: 'upgrade' },
        el('strong', {}, `🎓 ${t('UI_EDUCATION')}`),
        el('span', { class: 'chip good' }, '✓'),
      );
    const miss = s.educationMissing;
    const locks: HTMLElement[] = [];
    if (miss.rep > 0)
      locks.push(
        el(
          'span',
          { class: 'chip lock' },
          t('UI_LOCKED', { rep: s.unlockRep('education') ?? '?' }),
        ),
      );
    if (miss.cafe) locks.push(el('span', { class: 'chip lock' }, t('UI_STAFF_NEEDS_CAFE')));
    return el(
      'div',
      { class: 'upgrade cafe' },
      el(
        'div',
        {},
        el('strong', {}, `🎓 ${t('UI_EDUCATION')}`),
        el('p', { class: 'hint' }, t('UI_EDUCATION_DESC')),
      ),
      locks.length
        ? el('div', { class: 'locks' }, ...locks)
        : button(
            t('UI_BUY_CLINIC', { price }),
            () => {
              if (s.buyEducation()) this.closeModal();
            },
            { class: 'btn primary', disabled: s.money < price },
          ),
    );
  }

  /** Mačací hotel a dokupovanie apartmánov (GDD §6.7). */
  private hotelUpgrade(): HTMLElement[] {
    const s = this.state;
    const h = s.data.balance.hotel;
    if (s.hotel.open) {
      const price = s.nextSuitePrice;
      return [
        el(
          'div',
          { class: 'upgrade' },
          el('strong', {}, `🏨 ${t('UI_SUITES', { n: s.suiteCount })}`),
          price === null
            ? el('span', { class: 'muted' }, t('UI_MAXED'))
            : button(
                t('UI_BUY_SUITE', { price }),
                () => {
                  if (s.buySuite()) this.renderModal();
                },
                { class: 'btn primary', disabled: s.money < price },
              ),
        ),
      ];
    }
    const miss = s.hotelMissing;
    return [
      el(
        'div',
        { class: 'upgrade cafe' },
        el(
          'div',
          {},
          el('strong', {}, `🏨 ${t('UI_HOTEL')}`),
          el('p', { class: 'hint' }, t('UI_HOTEL_DESC', { n: h.suites })),
        ),
        miss.rep > 0
          ? el(
              'div',
              { class: 'locks' },
              el(
                'span',
                { class: 'chip lock' },
                t('UI_LOCKED', { rep: s.unlockRep('hotel') ?? '?' }),
              ),
            )
          : button(
              t('UI_BUY_CLINIC', { price: h.price }),
              () => {
                if (s.buyHotel()) this.closeModal();
              },
              { class: 'btn primary', disabled: s.money < h.price },
            ),
      ),
    ];
  }

  /** Catio – vonkajší výbeh pri kaviarni (GDD §6.6). */
  private catioUpgrade(): HTMLElement {
    const s = this.state;
    const price = s.data.balance.catio.price;
    if (s.catio.open)
      return el(
        'div',
        { class: 'upgrade' },
        el('strong', {}, `🌳 ${t('UI_CATIO')}`),
        el('span', { class: 'chip good' }, '✓'),
      );
    const miss = s.catioMissing;
    const locks: HTMLElement[] = [];
    if (miss.rep > 0)
      locks.push(
        el('span', { class: 'chip lock' }, t('UI_LOCKED', { rep: s.unlockRep('catio') ?? '?' })),
      );
    if (miss.cafe) locks.push(el('span', { class: 'chip lock' }, t('UI_STAFF_NEEDS_CAFE')));
    return el(
      'div',
      { class: 'upgrade cafe' },
      el(
        'div',
        {},
        el('strong', {}, `🌳 ${t('UI_CATIO')}`),
        el('p', { class: 'hint' }, t('UI_CATIO_DESC')),
      ),
      locks.length
        ? el('div', { class: 'locks' }, ...locks)
        : button(
            t('UI_BUY_CLINIC', { price }),
            () => {
              if (s.buyCatio()) this.closeModal();
            },
            { class: 'btn primary', disabled: s.money < price },
          ),
    );
  }

  /** Klinika – budova, potom tri miestnosti (GDD §6.5). */
  private clinicUpgrade(): HTMLElement[] {
    const s = this.state;
    const b = s.data.balance.clinic;
    if (!s.clinic.open) {
      const miss = s.clinicMissing;
      const locks: HTMLElement[] = [];
      if (miss.rep > 0)
        locks.push(
          el('span', { class: 'chip lock' }, t('UI_LOCKED', { rep: s.unlockRep('clinic') ?? '?' })),
        );
      if (miss.shelter) locks.push(el('span', { class: 'chip lock' }, t('UI_NEED_SHELTER')));
      return [
        el(
          'div',
          { class: 'upgrade cafe' },
          el(
            'div',
            {},
            el('strong', {}, `⚕️ ${t('UI_CLINIC')}`),
            el('p', { class: 'hint' }, t('UI_CLINIC_DESC')),
          ),
          locks.length
            ? el('div', { class: 'locks' }, ...locks)
            : button(
                t('UI_BUY_CLINIC', { price: b.price }),
                () => {
                  if (s.buyClinic()) this.closeModal();
                },
                { class: 'btn primary', disabled: s.money < b.price },
              ),
        ),
      ];
    }
    const icons = CLINIC_ICONS;
    const floorPrice = b.floor_price;
    const floor = s.hasFloor2
      ? el(
          'div',
          { class: 'upgrade' },
          el('strong', {}, `🏢 ${t('UI_FLOOR2')}`),
          el('span', { class: 'chip good' }, '✓'),
        )
      : el(
          'div',
          { class: 'upgrade cafe' },
          el(
            'div',
            {},
            el('strong', {}, `🏢 ${t('UI_FLOOR2')}`),
            el('p', { class: 'hint' }, t('UI_FLOOR2_DESC')),
          ),
          !s.hasUnlock('floors')
            ? el(
                'span',
                { class: 'chip lock' },
                t('UI_LOCKED', { rep: s.unlockRep('floors') ?? '?' }),
              )
            : button(
                t('UI_BUY_CLINIC', { price: floorPrice }),
                () => {
                  if (s.buyFloor()) this.renderModal();
                },
                { class: 'btn primary', disabled: s.money < floorPrice },
              ),
        );
    const rooms: ClinicRoomId[] = s.hasFloor2
      ? ['lab', 'xray', 'or', 'ct', 'pool']
      : ['lab', 'xray', 'or'];
    const list = rooms.map((room) => {
      const price = s.clinicRoomPrice(room);
      const unlock = s.clinicRoomUnlock(room);
      if (unlock && !s.hasUnlock(unlock) && !s.hasClinicRoom(room))
        return el(
          'div',
          { class: 'upgrade cafe' },
          el(
            'div',
            {},
            el('strong', {}, `${icons[room]} ${t(`CLINIC_${room.toUpperCase()}`)}`),
            el('p', { class: 'hint' }, t(`CLINIC_${room.toUpperCase()}_DESC`)),
          ),
          el('span', { class: 'chip lock' }, t('UI_LOCKED', { rep: s.unlockRep(unlock) ?? '?' })),
        );
      return el(
        'div',
        { class: 'upgrade cafe' },
        el(
          'div',
          {},
          el('strong', {}, `${icons[room]} ${t(`CLINIC_${room.toUpperCase()}`)}`),
          el('p', { class: 'hint' }, t(`CLINIC_${room.toUpperCase()}_DESC`)),
        ),
        s.hasClinicRoom(room)
          ? el('span', { class: 'chip good' }, '✓')
          : button(
              t('UI_BUY_FOR', { price }),
              () => {
                if (s.buyClinicRoom(room)) this.renderModal();
              },
              { class: 'btn primary', disabled: s.money < price },
            ),
      );
    });
    return [...list, floor];
  }

  /** Kúpa kaviarne, potom dokupovanie stolov (GDD §5.5). */
  private cafeUpgrade(): HTMLElement {
    const s = this.state;
    if (!s.cafe.open) {
      const price = s.data.balance.cafe.price;
      const locked = !s.hasUnlock('cafe');
      return el(
        'div',
        { class: 'upgrade cafe' },
        el(
          'div',
          {},
          el('strong', {}, `☕ ${t('UI_CAFE')}`),
          el('p', { class: 'hint' }, t('UI_CAFE_DESC', { slots: s.data.balance.cafe.slots })),
        ),
        locked
          ? el('span', { class: 'chip lock' }, t('UI_LOCKED', { rep: s.unlockRep('cafe') ?? '?' }))
          : button(
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
