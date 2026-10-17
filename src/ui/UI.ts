import './ui.css';
import { IMAGES, ZUZKA_SHEET, catSheetPath, personSheetPath } from '../assets';
import { CLINIC_FRAMES, INTERIOR_FRAMES, type FrameRect } from '../data/frames';
import { GameState } from '../core/GameState';
import * as Care from '../core/systems/Care';
import * as Late from '../core/systems/LateGame';
import type { Stars } from '../core/systems/Care';
import type { MatchResult } from '../core/systems/Match';
import type {
  AdopterDef,
  AdoptionRecord,
  AlbumEntry,
  CatData,
  ClinicRoomId,
  CatStats,
  DecorDef,
  DecorRoom,
  DiagnosticTool,
  SocialActivity,
  StoryBeat,
} from '../data/types';
import { generateCat } from '../core/systems/CatGenerator';
import { Rng } from '../core/Rng';
import { LANG_NAMES, LANGS, eur, lang, locale, setLang, t } from '../i18n/t';
import { button, el } from './dom';
import { DevMenu } from './DevMenu';
import {
  SUPPORT_URL,
  exitApp,
  hasWiki,
  isNative,
  onBackButton,
  openExternal,
  openWiki,
} from '../platform';
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
  /** Záloha hry (GDD §10.3): kód aktuálnej hry a jeho načítanie (potom sa hra načíta nanovo). */
  exportSave(): string | null;
  importSave(code: string): boolean;
  /** Miestnosť, ktorú vidí kamera, a prepnutie do inej (GDD §5.5). */
  readonly room: Room;
  showRoom(room: Room): void;
  /** Id stálic, ktoré sú práve vonku vo výbehu. */
  catsOutside(): string[];
  /** Vývojárske menu: rýchlosť času a okamžité uloženie. */
  readonly speed: number;
  setSpeed(speed: number): void;
  saveNow(): void;
  /** Hlavné menu / pauza zastaví herný čas. */
  setPaused(paused: boolean): void;
  readonly hadSave: boolean;
  /** Späť počas minihry ju zavrie; vráti true, ak nejaká bežala. */
  cancelMinigame(): boolean;
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
  | 'quiet'
  | 'exam_hand'
  | 'exam_thermo'
  | 'exam_steth'
  | 'exam_oto'
  | 'brush'
  | 'treat'
  | 'warm';
export interface MinigameRequest {
  kind: MinigameKind;
  cat: CatData;
  title: string;
  /** Röntgen: čo je na snímke (skrytá diagnóza mačky), null = nič. */
  xray?: 'fracture' | 'swallowed' | null;
  /** Operácia je kastrácia (bez kroku s pinzetou). */
  neuter?: boolean;
  /** Vyšetrenie: čo sa ním nájde (id + názov). */
  exam?: { id: string; name: string }[];
}

/** Druh minihry podľa ošetrenia alebo aktivity (GDD §4.2, §4.3). */
const TREATMENT_GAMES: Record<string, { kind: MinigameKind; titleKey: string }> = {
  tick_removal: { kind: 'tick_removal', titleKey: 'MG_TICK_TITLE' },
  bandage: { kind: 'bandage', titleKey: 'HOLD_BANDAGE' },
  ear_cleaning: { kind: 'ears', titleKey: 'HOLD_EAR' },
  syrup: { kind: 'syrup', titleKey: 'HOLD_SYRUP' },
  hold_brush: { kind: 'brush', titleKey: 'HOLD_BRUSH' },
  inhalation: { kind: 'breath', titleKey: 'MG_BREATH_TITLE' },
  bath: { kind: 'bath', titleKey: 'MG_BATH_TITLE' },
  nail_trim: { kind: 'claws', titleKey: 'MG_CLAWS_TITLE' },
  ear_drops: { kind: 'drops', titleKey: 'MG_DROPS_TITLE' },
  insulin: { kind: 'vaccine', titleKey: 'MG_INSULIN_TITLE' },
  splint: { kind: 'splint', titleKey: 'MG_SPLINT_TITLE' },
  swim: { kind: 'swim', titleKey: 'MG_SWIM_TITLE' },
  warm: { kind: 'warm', titleKey: 'MG_WARM_TITLE' },
  surgery: { kind: 'surgery', titleKey: 'MG_SURGERY_TITLE' },
};
/** Základné vyšetrenia ako minihry (krvný test, röntgen a CT majú vlastné). */
const EXAM_GAMES: Partial<Record<DiagnosticTool, { kind: MinigameKind; titleKey: string }>> = {
  hand: { kind: 'exam_hand', titleKey: 'MG_HAND_TITLE' },
  thermometer: { kind: 'exam_thermo', titleKey: 'MG_THERMO_TITLE' },
  stethoscope: { kind: 'exam_steth', titleKey: 'MG_STETH_TITLE' },
  otoscope: { kind: 'exam_oto', titleKey: 'MG_OTO_TITLE' },
};
const SOCIAL: {
  id: SocialActivity;
  icon: string;
  key: string;
  kind: MinigameKind;
  title: string;
}[] = [
  { id: 'feather', icon: '🪶', key: 'ACT_FEATHER', kind: 'feather', title: 'MG_FEATHER_TITLE' },
  { id: 'brush', icon: '🪮', key: 'ACT_BRUSH', kind: 'brush', title: 'HOLD_BRUSH' },
  { id: 'hand_feed', icon: '🐟', key: 'ACT_HAND_FEED', kind: 'treat', title: 'HOLD_TREAT' },
  {
    id: 'sit_quietly',
    icon: '🤫',
    key: 'ACT_SIT_QUIETLY',
    kind: 'quiet',
    title: 'ACT_SIT_QUIETLY',
  },
];

const REACTION_ICON = { love: '✨', ok: '🙂', meh: '💢' } as const;
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
type MenuTab = 'challenges' | 'achievements' | 'album' | 'postcards' | 'city' | 'shop';
/** Časti obchodu – aby sa nemuselo dlho rolovať. */
type ShopTab = 'build' | 'equipment' | 'staff' | 'decor' | 'cosmetics';

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

/** „MM-DD" → deň a mesiac podľa jazyka (20. 10. / 20/10 / 10月20日 …). */
function dayMonth(md: string): string {
  const [m = 1, d = 1] = md.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric' }).format(
    new Date(2026, m - 1, d),
  );
}
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
/** Meno záujemcu podľa variantu (GDD §5.1): `name_key`, `name_key_2`… */
function adopterName(def: AdopterDef, variant = 1): string {
  return t(variant > 1 ? `${def.name_key}_${variant}` : def.name_key);
}

/** Kľúč existuje v slovníku? (`t` vráti pri chýbajúcom kľúči samotný kľúč) */
const hasText = (key: string): boolean => t(key) !== key;

/**
 * Text pohľadnice (GDD §5.3): podľa záujemcu a zhody, kamarátka spomenie obe mačky,
 * a P.S. podľa povahy mačky. Tá istá pohľadnica má vždy ten istý text.
 */
function postcardText(
  rec: AdoptionRecord,
  def: AdopterDef | undefined,
  perfectAt: number,
): { main: string; ps: string | null } {
  let h = 2166136261; // FNV-1a
  for (const ch of `${rec.cat.id}:${rec.adoptedAt}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const roll = (n: number, salt: number) => ((h >>> 0) + salt * 7919) % n;
  const vars = { cat: rec.cat.name, friend: rec.friendOf ?? '' };
  let keys: string[];
  if (rec.friendOf) keys = ['POSTCARD_FRIEND_1', 'POSTCARD_FRIEND_2'];
  else {
    const base = rec.score >= perfectAt ? 'POSTCARD_PERFECT' : 'POSTCARD_GOOD';
    keys = [base, `${base}_2`, `${base}_3`, `${base}_4`];
    // dokonalá zhoda: aj texty od konkrétneho typu záujemcu
    const own = def
      ? [1, 2].map((n) => `POSTCARD_A_${def.id.toUpperCase()}_${n}`).filter(hasText)
      : [];
    if (def?.story && own.length) keys = own;
    else if (rec.score >= perfectAt && own.length) keys = [...own, ...own, ...keys];
  }
  const main = t(keys[roll(keys.length, 0)] ?? keys[0]!, vars);
  const traits = rec.cat.traits.map((x) => `POSTCARD_PS_${x.id.toUpperCase()}`).filter(hasText);
  const ps = traits.length ? t(traits[roll(traits.length, 1)]!) : null;
  return { main, ps };
}

const round1 = (n: number): string =>
  (Math.round(n * 10) / 10).toLocaleString(locale, { maximumFractionDigits: 1 });

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
  /** Ponuka alebo prebiehajúca udalosť (GDD §7.3) – skrytá, keď nič nie je. */
  private eventPill = el('button', { class: 'pill event-pill', type: 'button', hidden: true });
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
  /** Bublina, keď hráč ťukne na postavičku (Zuzka, personál). */
  private speech = el('div', { class: 'zuzka speech', hidden: true, role: 'status' });
  private speechTimer = 0;
  private sheet = el('aside', { class: 'sheet empty', 'aria-live': 'polite' });
  private modal = el('div', { class: 'modal', hidden: true, role: 'dialog', 'aria-modal': 'true' });
  private toasts = el('div', { class: 'toasts' });
  private selectedId: string | null = null;
  private tab: CardTab = 'health';
  private tabFor: string | null = null;
  private busy = false;
  private muted = false;
  private modalKind:
    'reports' | 'visitors' | 'menu' | 'welcome' | 'station' | 'event' | 'pause' | 'story' | null =
    null;
  /** Príbeh (GDD §8): práve zobrazená scénka a riadok. */
  private storyBeat: StoryBeat | null = null;
  private storyLine = 0;
  /** Hlavné menu (úvodná obrazovka) – ukáže sa pri spustení a z pauzy. */
  private title = el('div', { class: 'title-screen', role: 'dialog', 'aria-modal': 'true' });
  private titleView: 'main' | 'settings' | 'new' | 'backup' | 'support' = 'main';
  /** Záloha hry: zobrazený kód a či posledný import zlyhal. */
  private backupCode: string | null = null;
  private backupError = false;
  /** Po prvom „Hrať" už hlavné menu ponúka Pokračovať a Novú hru. */
  private started = false;
  private confirmExit = false;
  /** Rozbalená stará pohľadnica v Pošte. */
  private openPostcard: string | null = null;
  private postcardBatch = 0;
  private confirmPrestige = false;
  /** Miestnosť vybraná v Obchode → Dekorácie. */
  private decorRoom: DecorRoom = 'garage';
  private heartBatch = 0;
  /** Prístroj kliniky, pri ktorom hráč vyberá pacienta. */
  private stationRoom: ClinicRoomId = 'lab';
  private shopTab: ShopTab = 'build';
  /** Čo okno naposledy ukazovalo – pri prekreslení toho istého sa zachová posun. */
  private modalViewKey = '';
  private menuTab: MenuTab = 'challenges';
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
    this.root.append(
      this.hud,
      this.sheet,
      this.zuzka,
      this.speech,
      this.modal,
      this.toasts,
      this.title,
    );
    document.body.append(this.root);
    this.modal.addEventListener('click', (e) => {
      // scénka príbehu sa nezavrie omylom ťuknutím vedľa (inak by sa hneď ukázala znova)
      if (e.target === this.modal && this.modalKind !== 'story') this.closeModal();
    });
    this.subscribe();
    this.layout();
    window.addEventListener('resize', () => this.layout());
    this.renderSheet();
    this.updateHud();
    window.setInterval(() => this.tick(), 500);
    this.started = this.game.hadSave;
    this.showTitle();
    onBackButton(() => this.back());
    // Na PC funguje Escape ako Späť (vývojárske menu si Escape spracuje samo)
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && !this.dev.isOpen && !isNative) this.back();
      },
      true,
    );
  }

  // ---------- Hlavné menu, pauza, tlačidlo Späť ----------

  private showTitle(): void {
    this.titleView = 'main';
    this.title.hidden = false;
    this.game.setPaused(true);
    this.renderTitle();
  }

  private hideTitle(): void {
    this.title.hidden = true;
    this.started = true;
    this.game.setPaused(this.modalKind === 'pause');
    this.game.playSound('open', 0.4);
  }

  private setTitleView(v: UI['titleView']): void {
    this.titleView = v;
    this.renderTitle();
  }

  private quit(): void {
    this.game.saveNow();
    exitApp();
  }

  private renderTitle(): void {
    const box = el(
      'div',
      { class: 'title-box' },
      el('img', { class: 'title-logo', src: 'icon.png', alt: '' }),
      el('h1', {}, 'Meow Ambulance'),
      el('p', { class: 'title-tag' }, t('TITLE_TAGLINE')),
    );
    if (this.titleView === 'settings') {
      box.append(
        el('h2', {}, t('TITLE_SETTINGS')),
        ...this.settingsControls(),
        button(`← ${t('TITLE_BACK')}`, () => this.setTitleView('main')),
      );
    } else if (this.titleView === 'backup') {
      box.append(...this.backupContent());
    } else if (this.titleView === 'support') {
      // Hru hrajú aj deti – podpora je dobrovoľná, bez pripomínania v hre a s vysvetlením pre rodičov
      box.append(
        el('h2', {}, `❤ ${t('TITLE_SUPPORT')}`),
        el('p', {}, t('SUPPORT_TEXT')),
        el('p', { class: 'hint' }, t('SUPPORT_KIDS')),
        button(`${t('SUPPORT_OPEN')} ↗`, () => openExternal(SUPPORT_URL), {
          class: 'btn primary',
        }),
        button(`← ${t('TITLE_BACK')}`, () => this.setTitleView('main')),
      );
    } else if (this.titleView === 'new') {
      box.append(
        el('p', { class: 'warning' }, t('UI_NEW_GAME_CONFIRM')),
        el(
          'div',
          { class: 'footer' },
          button(t('UI_CANCEL'), () => this.setTitleView('main')),
          button(t('UI_YES_DELETE'), () => this.game.resetGame(), { class: 'btn primary' }),
        ),
      );
    } else {
      box.append(
        button(`▶ ${t(this.started ? 'TITLE_CONTINUE' : 'TITLE_PLAY')}`, () => this.hideTitle(), {
          class: 'btn primary big',
        }),
        button(`⚙️ ${t('TITLE_SETTINGS')}`, () => this.setTitleView('settings')),
        ...(hasWiki ? [button(`📖 ${t('TITLE_WIKI')}`, () => openWiki(lang))] : []),
        ...(SUPPORT_URL
          ? [button(`❤ ${t('TITLE_SUPPORT')}`, () => this.setTitleView('support'))]
          : []),
        button(`💾 ${t('BACKUP_TITLE')}`, () => {
          this.backupCode = null;
          this.backupError = false;
          this.setTitleView('backup');
        }),
        ...(this.started ? [button(`↺ ${t('UI_NEW_GAME')}`, () => this.setTitleView('new'))] : []),
        ...(isNative ? [button(`🚪 ${t('TITLE_EXIT')}`, () => this.quit())] : []),
        el('p', { class: 'hint' }, t('TITLE_SAVED')),
      );
    }
    this.title.replaceChildren(box);
  }

  /**
   * Záloha hry (GDD §10.3): kód na skopírovanie a vloženie – prenos na iné zariadenie
   * alebo poistka pred stratou dát. Na webe aj ako súbor.
   */
  private backupContent(): HTMLElement[] {
    const tryImport = (code: string) => {
      if (this.game.importSave(code)) return; // hra sa načíta nanovo
      this.backupError = true;
      this.renderTitle();
    };

    const exportBtn = button(`📋 ${t('BACKUP_COPY')}`, () => {
      this.backupCode = this.game.exportSave();
      this.renderTitle();
      if (this.backupCode)
        void navigator.clipboard?.writeText(this.backupCode).then(
          () => this.toast(t('BACKUP_COPIED')),
          () => undefined,
        );
    });
    const out: HTMLElement[] = [
      el('h2', {}, `💾 ${t('BACKUP_TITLE')}`),
      el('p', { class: 'hint' }, t('BACKUP_HINT')),
      exportBtn,
    ];
    if (this.backupCode) {
      const shown = el('textarea', { class: 'backup-code', readonly: 'readonly', rows: '3' });
      shown.value = this.backupCode;
      shown.addEventListener('focus', () => shown.select());
      out.push(shown);
      if (!isNative) {
        const code = this.backupCode;
        out.push(
          button(`⬇️ ${t('BACKUP_DOWNLOAD')}`, () => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
            a.download = `meow-ambulance-${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();
            URL.revokeObjectURL(a.href);
          }),
        );
      }
    }

    const input = el('textarea', {
      class: 'backup-code',
      rows: '3',
      placeholder: t('BACKUP_PASTE'),
    });
    out.push(
      el('h3', {}, t('BACKUP_IMPORT')),
      el('p', { class: 'warning' }, t('BACKUP_REPLACE_WARN')),
      input,
      button(`📥 ${t('BACKUP_LOAD')}`, () => tryImport(input.value), { class: 'btn primary' }),
    );
    if (!isNative) {
      const file = el('input', { type: 'file', accept: '.txt,text/plain', class: 'backup-file' });
      file.addEventListener('change', () => {
        void file.files?.[0]?.text().then(tryImport);
      });
      out.push(el('label', { class: 'btn backup-file-btn' }, `📂 ${t('BACKUP_FROM_FILE')}`, file));
    }
    if (this.backupError) out.push(el('p', { class: 'warning' }, t('BACKUP_INVALID')));
    out.push(button(`← ${t('TITLE_BACK')}`, () => this.setTitleView('main')));
    return out;
  }

  /** Zvuk a jazyk – v hlavnom menu aj v pauze. */
  private settingsControls(): HTMLElement[] {
    return [
      button(this.muted ? `🔇 ${t('UI_SOUND_OFF')}` : `🔊 ${t('UI_SOUND_ON')}`, () =>
        this.toggleMute(),
      ),
      el(
        'div',
        { class: 'actions lang-row' },
        ...LANGS.map((l) =>
          button(
            LANG_NAMES[l],
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
  }

  /** Pauza: čas stojí; nastavenia, hlavné menu, ukončenie (Android). */
  private pauseContent(): HTMLElement[] {
    const s = this.state;
    const out: HTMLElement[] = [
      el('h2', {}, `⏸ ${t('UI_PAUSE')}`),
      el('p', { class: 'hint' }, t('UI_PAUSE_HINT')),
      button(`▶ ${t('UI_RESUME')}`, () => this.closeModal(), { class: 'btn primary big' }),
      ...this.settingsControls(),
      el(
        'p',
        { class: 'hint' },
        t('UI_STATS_LINE', { r: s.counters.rescued, a: s.counters.adopted }),
      ),
      ...(hasWiki ? [button(`📖 ${t('TITLE_WIKI')}`, () => openWiki(lang))] : []),
      button(`🏠 ${t('UI_MAIN_MENU')}`, () => {
        this.game.saveNow();
        this.closeModal();
        this.showTitle();
      }),
    ];
    if (isNative) {
      if (!this.confirmExit)
        out.push(
          button(`🚪 ${t('TITLE_EXIT')}`, () => {
            this.confirmExit = true;
            this.renderModal();
          }),
        );
      else
        out.push(
          el('p', { class: 'warning' }, t('UI_EXIT_CONFIRM')),
          el(
            'div',
            { class: 'footer' },
            button(t('UI_CANCEL'), () => {
              this.confirmExit = false;
              this.renderModal();
            }),
            button(t('UI_EXIT_YES'), () => this.quit(), { class: 'btn primary' }),
          ),
        );
    }
    return out;
  }

  /** Systémové tlačidlo Späť (Android): zavrie to, čo je navrchu; inak otvorí pauzu. */
  private back(): void {
    if (this.dev.isOpen) {
      this.dev.close();
      return;
    }
    if (!this.title.hidden) {
      if (this.titleView !== 'main') this.setTitleView('main');
      else if (isNative) this.quit();
      else this.hideTitle();
      return;
    }
    if (this.game.cancelMinigame()) return;
    if (!this.modal.hidden) {
      if (this.modalKind === 'pause' && this.confirmExit) {
        this.confirmExit = false;
        this.renderModal();
      } else if (this.modalKind === 'story') this.finishStory();
      else this.closeModal();
      return;
    }
    if (this.selectedId) {
      this.game.select(null);
      return;
    }
    this.openModal('pause');
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
    this.eventPill.addEventListener('click', () => this.openModal('event'));
    this.hud.append(
      this.clockPill,
      this.moneyPill,
      this.repPill,
      this.eventPill,
      el('div', { class: 'spacer' }),
      this.roomBtn,
      iconBtn('📋', t('UI_REPORTS'), this.badges.reports, () => this.openModal('reports')),
      iconBtn('🚪', t('UI_VISITORS'), this.badges.visitors, () => this.openModal('visitors')),
      iconBtn('☰', t('UI_MENU'), this.badges.menu, () => this.openMenu()),
      iconBtn('⏸', t('UI_PAUSE'), null, () => this.openModal('pause')),
    );
  }

  private updateHud(): void {
    const s = this.state;
    const phaseIcon = { night: '🌙', morning: '🌅', day: '☀️', evening: '🌆' }[s.dayPhase];
    this.clockPill.textContent = `${phaseIcon} ${s.clock}`;
    this.moneyPill.textContent = eur(Math.floor(s.money));
    this.repPill.textContent = `★ ${s.reputation}`;
    this.setBadge(this.badges.reports, s.reports.length);
    this.setBadge(this.badges.visitors, s.adopters.length);
    this.setBadge(this.badges.menu, s.claimableChallenges + this.unseenPostcards);
    this.updateRoomButton();
    this.updateEventPill();
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

  /** Pilulka udalosti: ponuka s „!", prebiehajúca s odpočtom. */
  private updateEventPill(): void {
    const s = this.state;
    const a = s.events.active;
    const id = a?.id ?? s.events.offer;
    const def = id ? s.eventDef(id) : undefined;
    this.eventPill.hidden = !def;
    this.root.classList.toggle('hud-2row', !!def);
    if (!def) return;
    let text: string;
    if (a) {
      const left = Math.max(0, Math.ceil((a.endsAt - s.now) / 1000));
      text = `${def.icon} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    } else text = `${def.icon} !`;
    if (this.eventPill.textContent !== text) this.eventPill.textContent = text;
    this.eventPill.classList.toggle('offer', !a);
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

  // ---------- Postavičky: ťuknutie = čo práve robia (GDD §6.4) ----------

  /** Hráč ťukol na postavičku vo svete – povie, čo sa deje a čo by pomohlo. */
  personTapped(role: string): void {
    const s = this.state;
    const staff = s.data.staff.find((d) => d.id === role);
    const sheet =
      role === 'zuzka'
        ? ZUZKA_SHEET
        : role === 'barista'
          ? s.data.balance.cafe.barista_sprite
          : role === 'receptionist'
            ? s.data.balance.hotel.receptionist_sprite
            : (staff?.sprite ?? ZUZKA_SHEET);
    const name =
      role === 'zuzka'
        ? 'Zuzka'
        : role === 'receptionist'
          ? t('SAY_RECEPTIONIST')
          : t(staff?.name_key ?? role);
    this.say(sheet, name, this.personLine(role));
    this.game.playSound('click', 0.3);
  }

  private personLine(role: string): string {
    const s = this.state;
    const patients = s.cats.filter((c) => !c.resident);
    switch (role) {
      case 'vet': {
        const n = patients.filter(
          (c) =>
            c.examined.length < s.tools.length ||
            c.conditions.some((x) => x.revealed && !x.treated),
        ).length;
        return n ? t('SAY_VET_BUSY', { n }) : t('SAY_VET_IDLE');
      }
      case 'caretaker': {
        const n = [...s.cats, ...s.hotel.guests].filter((c) => c.stats.satisfaction < 40).length;
        return n ? t('SAY_CARE_BUSY', { n }) : t('SAY_CARE_IDLE');
      }
      case 'social': {
        const ready = patients.filter((c) => s.isReady(c)).length;
        if (s.adopters.length) return t('SAY_SOCIAL_ADOPTERS', { n: s.adopters.length });
        return ready ? t('SAY_SOCIAL_READY', { n: ready }) : t('SAY_SOCIAL_IDLE');
      }
      case 'barista': {
        const waiting = s.cafe.guests.filter((g) => !g.served).length;
        if (waiting) return t('SAY_BARISTA_BUSY', { n: waiting });
        const r = s.cafeRating;
        return r !== null ? t('SAY_BARISTA_RATING', { r: round1(r) }) : t('SAY_BARISTA_IDLE');
      }
      case 'receptionist':
        return s.hotel.guests.length
          ? t('SAY_HOTEL', { n: s.hotel.guests.length, max: s.suiteCount })
          : t('SAY_HOTEL_EMPTY');
      default: {
        const hint = s.tutorialHint;
        if (hint) return t(hint);
        if (s.claimableChallenges > 0) return t('SAY_ZUZKA_CHALLENGE');
        if (s.reports.length) return t('SAY_ZUZKA_REPORTS', { n: s.reports.length });
        const sick = patients.filter((c) => c.conditions.some((x) => !x.treated)).length;
        if (sick) return t('SAY_ZUZKA_TREAT', { n: sick });
        if (s.adopters.length && patients.some((c) => s.isReady(c))) return t('SAY_ZUZKA_ADOPT');
        return t(`SAY_ZUZKA_IDLE_${1 + Math.floor(Math.random() * 4)}`);
      }
    }
  }

  /** Bublina s portrétom na pár sekúnd (ťuknutím zmizne). */
  private say(sheet: string, name: string, text: string): void {
    window.clearTimeout(this.speechTimer);
    this.speech.replaceChildren(
      personPortrait(sheet, 1.5),
      el('p', {}, el('strong', {}, name), el('br'), text),
    );
    this.speech.hidden = false;
    this.zuzka.hidden = true;
    this.speech.onclick = () => this.hideSpeech();
    this.speechTimer = window.setTimeout(() => this.hideSpeech(), 5000);
  }

  private hideSpeech(): void {
    this.speech.hidden = true;
    this.updateZuzka();
  }

  /** Bublina s radou od Zuzky (tutoriál) – mení sa podľa postupu hráča. */
  private updateZuzka(): void {
    const key = this.state.tutorialHint;
    const hide = key === null || this.modalKind !== null || !this.speech.hidden;
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
    this.zuzka.replaceChildren(personPortrait(ZUZKA_SHEET, 1.5), el('p', {}, t(key)), skip);
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
    if (this.modalKind === 'menu' || this.modalKind === 'pause') this.renderModal();
    if (!this.title.hidden) this.renderTitle();
  }

  private tick(): void {
    this.updateHud();
    this.maybeShowStory();
    this.maybeGreetSeason();
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
    // odpočet bežiacej kampane v menu
    if (this.modalKind === 'menu' && this.menuTab === 'city' && this.state.campaigns.active)
      this.renderModal();
    // odpočet Dňa adopcií / prestávky v okne záujemcov (iba ak sa nič nevyberá)
    if (
      this.modalKind === 'visitors' &&
      !this.selectedForVisit &&
      (this.state.adoptionDayActive || this.state.adoptionDayCooldown > 0)
    )
      this.renderModal();
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
    bus.on('catAdmitted', ({ cat, returned }) => {
      this.toast(t(returned ? 'TOAST_RETURNED' : 'TOAST_ADMITTED', { cat: cat.name }));
      if (returned) this.game.playSound('mew', 0.5);
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
    // viac pohľadníc naraz (napr. po offline čase) = jedno oznámenie
    bus.on('postcardArrived', () => {
      this.postcardBatch += 1;
      if (this.postcardBatch > 1) return;
      window.setTimeout(() => {
        const n = this.postcardBatch;
        this.postcardBatch = 0;
        this.toast(n > 1 ? t('TOAST_POSTCARDS', { n }) : t('TOAST_POSTCARD'));
        this.game.playSound('camera', 0.5, 'notify');
      }, 50);
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
    bus.on('albumPageDone', ({ page }) => {
      this.toast(
        t('TOAST_ALBUM_PAGE', {
          page: this.albumPageName(page),
          hearts: this.state.data.cosmetics?.hearts.album_page ?? 0,
          money: this.state.data.balance.rewards.album_page_money,
        }),
      );
      this.game.playSound('success', 0.6);
      if (this.modalKind === 'menu') this.renderModal();
    });
    bus.on('honorEarned', ({ n, gained }) => {
      const h = this.state.data.balance.honors;
      this.toast(
        t('TOAST_HONOR', {
          title: t(Late.honorTitleKey(this.state.data, n)),
          hearts: h.hearts * gained,
          money: h.money * gained,
        }),
      );
      this.game.playSound('upgrade', 0.6);
      this.game.playSound('mewPurr', 0.5);
      if (this.modalKind === 'menu') this.renderModal();
    });
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
    bus.on('heartsChanged', ({ delta }) => {
      // viac srdiečok naraz (napr. kopa pohľadníc) = jedno oznámenie
      if (delta > 0) {
        if (this.heartBatch === 0)
          window.setTimeout(() => {
            this.toast(t('TOAST_HEARTS', { n: this.heartBatch }));
            this.heartBatch = 0;
          }, 50);
        this.heartBatch += delta;
      }
      if (this.modalKind === 'menu' && this.menuTab === 'shop') this.renderModal();
    });
    bus.on('eventOffered', ({ def }) => {
      this.toast(t('TOAST_EVENT_OFFER', { name: t(`EVENT_${def.id.toUpperCase()}`) }));
      this.game.playSound('notify', 0.5);
      this.updateHud();
    });
    bus.on('eventStarted', ({ def }) => {
      this.toast(t('TOAST_EVENT_START', { name: t(`EVENT_${def.id.toUpperCase()}`) }));
      this.updateHud();
    });
    bus.on('eventEnded', ({ def, bonus, money, rep }) => {
      this.toast(
        t(bonus ? 'TOAST_EVENT_END_BONUS' : 'TOAST_EVENT_END', {
          name: t(`EVENT_${def.id.toUpperCase()}`),
          money,
          rep,
        }),
      );
      this.game.playSound('success', 0.5);
      this.updateHud();
      if (this.modalKind === 'event') this.renderModal();
    });
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
    bus.on('campaignPrestige', ({ gained }) => {
      this.toast(t('TOAST_PRESTIGE', { n: gained }));
      this.game.playSound('success', 0.6);
    });
    bus.on('adoptionDay', ({ active }) => {
      this.toast(t(active ? 'TOAST_ADAY_ON' : 'TOAST_ADAY_OFF'));
      if (active) this.game.playSound('success', 0.5);
      if (this.modalKind === 'visitors') this.renderModal();
    });
    bus.on('wishAppeared', ({ cat }) => this.toast(t('TOAST_WISH', { cat: cat.name })));
    bus.on('wishGranted', ({ cat }) => this.toast(t('TOAST_WISH_DONE', { cat: cat.name })));
    bus.on('campaignStarted', () => {
      this.toast(t('TOAST_CAMPAIGN_START'));
      this.game.playSound('success', 0.4);
    });
    bus.on('campaignDone', ({ district, cleared }) => {
      const { name } = this.districtName(district);
      this.toast(t(cleared ? 'TOAST_DISTRICT_CLEARED' : 'TOAST_CAMPAIGN_DONE', { name }));
      this.game.playSound('success', 0.5);
      if (this.modalKind === 'menu') this.renderModal();
    });
    bus.on('guestLeft', ({ amount, review }) => {
      this.toast(`${t('TOAST_GUEST_TIP', { n: round1(amount) })} · ${'★'.repeat(review.stars)}`);
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
        el('h2', {}, cat.name, cat.special ? ' ✨' : '', ' ', status),
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
          'p',
          { class: 'hint' },
          Care.isGlowing(cat, data)
            ? `✨ ${t('UI_GLOW_ON', { p: Math.round((data.balance.glow?.fee_bonus ?? 0) * 100) })}`
            : t('UI_GLOW_TIP'),
        ),
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
      out.push(...this.statusChips(cat), ...this.shelterActions(cat), ...this.clinicActions(cat));
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
    out.push(...this.statusChips(cat), ...this.shelterActions(cat), ...this.clinicActions(cat));
    return out;
  }

  /** Hotové zákroky ako štítky v jednom riadku: očkovaná, kastrovaná, po rehabilitácii. */
  private statusChips(cat: CatData): HTMLElement[] {
    if (cat.resident || cat.hotel) return [];
    const chips: HTMLElement[] = [];
    if (cat.vaccinated) chips.push(el('span', { class: 'chip good' }, `💉 ${t('UI_VACCINATED')}`));
    if (cat.neutered) chips.push(el('span', { class: 'chip good' }, `✂️ ${t('UI_NEUTERED')}`));
    if (cat.rehabbed) chips.push(el('span', { class: 'chip good' }, `🏊 ${t('UI_REHABBED')}`));
    return chips.length ? [el('div', { class: 'chips' }, ...chips)] : [];
  }

  /** Klinika: kastrácia pred adopciou (GDD §6.5). */
  private clinicActions(cat: CatData): HTMLElement[] {
    const s = this.state;
    if (cat.resident || cat.hotel) return [];
    const out: HTMLElement[] = [];
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
    if (!cat.vaccinated && cat.conditions.every((c) => c.treated))
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
      const r = cat.reactions?.[a.id];
      const b = button(
        `${a.icon} ${t(a.key)}${r ? ` ${REACTION_ICON[r]}` : ''}`,
        () => void this.doSocial(cat, a),
        {
          disabled: this.busy || socialLeft > 0,
        },
      );
      if (socialLeft > 0) b.append(el('small', {}, t('UI_RESTING', { s: socialLeft })));
      care.append(b);
    }
    const feedBtn = button(`🍽️ ${t('ACT_FEED')}`, () => this.doFeed(cat), {
      class: 'btn wide',
      disabled: this.busy || feedLeft > 0,
    });
    if (feedLeft > 0) feedBtn.append(el('small', {}, t('UI_RESTING', { s: feedLeft })));
    care.append(feedBtn);
    const out = [...this.wishBlock(cat), care];
    // Stálica-pomocníčka upokojuje nedôverčivých pacientov (GDD §5.4)
    const helper = s.helperMult(cat) > 1 ? s.helper : undefined;
    if (helper) out.push(el('p', { class: 'hint' }, `🤝 ${t('UI_HELPER', { cat: helper.name })}`));
    return out;
  }

  /**
   * Obchod → Dekorácie (GDD §6.1.3): rovnaký postup pre každú miestnosť – výber miestnosti,
   * útulnosť a čo prináša, dekorácie od najlacnejšej, farba stien (kúpené za ❤).
   */
  private decorContent(): HTMLElement[] {
    const s = this.state;
    const cz = s.data.balance.coziness;
    const rooms: { id: DecorRoom; icon: string; name: string }[] = [
      { id: 'garage', icon: '🚑', name: t('UI_ROOM_GARAGE') },
      { id: 'cafe', icon: '☕', name: t('UI_ROOM_CAFE') },
      { id: 'clinic', icon: '🩺', name: t('UI_ROOM_CLINIC') },
      { id: 'hotel', icon: '🏨', name: t('UI_ROOM_HOTEL') },
    ];
    const room = this.decorRoom;
    const chips = el('div', { class: 'room-chips' });
    for (const r of rooms) {
      const open = s.decorRoomOpen(r.id);
      const b = el(
        'button',
        { class: `btn room-chip${r.id === room ? ' primary' : ''}`, type: 'button' },
        `${r.icon} ${r.name}`,
        el('small', {}, open ? `🛋️ ${s.coziness(r.id)}` : '🔒'),
      );
      b.addEventListener('click', () => {
        this.decorRoom = r.id;
        this.renderModal();
      });
      chips.append(b);
    }
    const cozy = s.coziness(room);
    const effect =
      room === 'garage'
        ? t('UI_COZY_GARAGE', { p: Math.round(cozy * cz.garage_trust_per_point * 100) })
        : room === 'cafe'
          ? t('UI_COZY_CAFE', { p: Math.round(cozy * cz.cafe_tip_per_point * 100) })
          : room === 'clinic'
            ? t('UI_COZY_CLINIC', { p: Math.round(cozy * cz.clinic_heal_per_point * 100) })
            : t('UI_COZY_HOTEL', { p: Math.round(cozy * cz.hotel_fee_per_point * 100) });
    const out: HTMLElement[] = [chips];
    if (!s.decorRoomOpen(room)) {
      out.push(
        el(
          'p',
          { class: 'warning' },
          t('UI_DECOR_ROOM_LOCKED', { room: rooms.find((r) => r.id === room)?.name ?? '' }),
        ),
      );
      return out;
    }
    const defs = s.data.decor.filter((d) => d.room === room).sort((a, b) => a.price - b.price);
    const owned = defs.filter((d) => s.decor.includes(d.id)).length;
    out.push(
      el(
        'div',
        { class: 'cozy-card' },
        el('strong', {}, `🛋️ ${t('UI_COZY_TITLE', { n: cozy })}`),
        el(
          'p',
          { class: 'hint' },
          `${effect} · ${t('UI_DECOR_OWNED', { n: owned, total: defs.length })}`,
        ),
      ),
    );
    for (const def of defs) {
      const has = s.decor.includes(def.id);
      const locked = def.unlock !== undefined && !s.hasUnlock(def.unlock);
      out.push(
        el(
          'div',
          { class: `shop-item${has ? ' owned' : ''}` },
          el('span', { class: 'shop-icon' }, decorPreview(def)),
          el(
            'div',
            { class: 'grow' },
            el('strong', {}, t(def.name_key)),
            el('p', { class: 'hint' }, `🛋️ +${def.cozy}`),
          ),
          has
            ? el('span', { class: 'chip good' }, '✓')
            : locked
              ? el(
                  'span',
                  { class: 'chip lock' },
                  t('UI_LOCKED', { rep: (def.unlock ? s.unlockRep(def.unlock) : null) ?? '?' }),
                )
              : button(
                  eur(def.price),
                  () => {
                    if (s.buyDecor(def.id)) this.renderModal();
                  },
                  { class: 'btn primary', disabled: s.money < def.price },
                ),
        ),
      );
    }
    // farba stien – iba garáž a kaviareň (ostatné miestnosti majú obklady)
    if (room === 'garage' || room === 'cafe') out.push(...this.wallPicker(room));
    return out;
  }

  /** Výber farby stien miestnosti (farby sa kupujú za ❤ v záložke Srdiečka). */
  private wallPicker(room: 'garage' | 'cafe'): HTMLElement[] {
    const s = this.state;
    const c = s.data.cosmetics;
    if (!c) return [];
    const owned = c.walls.filter((w) => s.cosmetics.owned.includes(w.id));
    const head = el('h3', {}, `🎨 ${t('UI_WALLS_TITLE')}`);
    if (!owned.length) return [head, el('p', { class: 'hint' }, t('UI_WALLS_BUY_HINT'))];
    const cur = s.cosmetics.walls[room] ?? null;
    const set = (id: string | null) => () => {
      if (s.setWall(room, id)) this.renderModal();
    };
    return [
      head,
      el(
        'div',
        { class: 'actions' },
        button(t('UI_WALL_DEFAULT'), set(null), { class: cur ? 'btn' : 'btn primary' }),
        ...owned.map((w) =>
          button(`${w.icon} ${t(`WALL_${w.id.toUpperCase()}`)}`, set(w.id), {
            class: cur === w.id ? 'btn primary' : 'btn',
          }),
        ),
      ),
    ];
  }

  /** Obchod → Ozdoby: srdiečka a farby stien (GDD §7.6). */
  private cosmeticsContent(): HTMLElement[] {
    const s = this.state;
    const c = s.data.cosmetics;
    if (!c) return [];
    const item = (id: string, icon: string, name: string, price: number) =>
      el(
        'div',
        { class: 'shop-item' },
        el('span', { class: 'shop-icon' }, icon),
        el('div', { class: 'grow' }, el('strong', {}, name)),
        s.cosmetics.owned.includes(id)
          ? el('span', { class: 'chip good' }, '✓')
          : button(
              `${price} ❤`,
              () => {
                if (s.buyCosmetic(id)) this.renderModal();
              },
              { class: 'btn primary', disabled: s.hearts < price },
            ),
      );
    return [
      el('p', { class: 'hearts-line' }, t('UI_HEARTS_LINE', { n: s.hearts })),
      el('p', { class: 'hint' }, t('UI_HEARTS_HINT')),
      el('h3', {}, `🎉 ${t('UI_ADAY_TITLE')}`),
      this.adoptionDayBlock(),
      el('p', { class: 'hint' }, `💭 ${t('UI_WISH_SHOP_HINT')}`),
      el('h3', {}, t('UI_WALLS_TITLE')),
      el('p', { class: 'hint' }, t('UI_WALLS_APPLY_HINT')),
      ...c.walls.map((w) => item(w.id, w.icon, t(`WALL_${w.id.toUpperCase()}`), w.price)),
    ].filter((x): x is HTMLElement => typeof x !== 'string');
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
      ...this.likesSection(cat),
      cat.clinicCase ? el('p', { class: 'hint' }, `💗 ${t('UI_CLINIC_CASE')}`) : el('span'),
      cat.special
        ? el(
            'p',
            { class: 'hint rare' },
            `✨ ${t(`RARE_${cat.special.toUpperCase()}`)} – ${t('UI_RARE_HINT')}`,
          )
        : el('span'),
      report
        ? el('p', { class: 'hint' }, t('UI_FOUND_AT', { where: t(report.name_key) }))
        : el('span'),
    ];
  }

  /** Čo má mačka rada – podľa toho, ako reagovala na aktivity (GDD §4.3). */
  private likesSection(cat: CatData): HTMLElement[] {
    const r = cat.reactions ?? {};
    const rows = SOCIAL.map((a) => {
      const v = r[a.id];
      return el(
        'div',
        { class: `like-row ${v ?? 'unknown'}` },
        el('span', {}, `${a.icon} ${t(a.key)}`),
        el(
          'span',
          { class: 'like-val' },
          v
            ? `${REACTION_ICON[v]} ${t(`UI_LIKE_${v.toUpperCase()}`)}`
            : `❔ ${t('UI_LIKE_UNTRIED')}`,
        ),
      );
    });
    const tried = SOCIAL.filter((a) => r[a.id]).length;
    return [
      el('h3', {}, t('UI_LIKES')),
      el('div', { class: 'likes' }, ...rows),
      tried < SOCIAL.length ? el('p', { class: 'hint' }, t('UI_LIKES_HINT')) : el('span'),
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
    // stálice vonku vo výbehu sú v prehľade výbehu, nie tu
    const outside = this.game.catsOutside();
    const inside = s.residents.filter((c) => !outside.includes(c.id));
    const residents = inside.map((cat) => this.catTile(cat));
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
      ...this.cafeReviews(),
      s.residents.length === 0
        ? el('p', { class: 'warning' }, t('UI_CAFE_NO_RESIDENTS'))
        : rows.length === 0
          ? el('p', { class: 'muted' }, t(s.cafeOpenNow ? 'UI_CAFE_NO_GUESTS' : 'UI_CAFE_CLOSED'))
          : el('div', { class: 'guests' }, ...rows),
      residents.length ? el('div', { class: 'cat-list' }, ...residents) : '',
      outside.length
        ? el('p', { class: 'hint' }, `🌳 ${t('UI_CAFE_OUTSIDE', { n: outside.length })}`)
        : '',
      this.staffHere('cafe'),
      this.panelButtons(),
    );
  }

  /** Hodnotenie kaviarne: priemer, vplyv na hostí a posledné odkazy (GDD §5.5). */
  private cafeReviews(): HTMLElement[] {
    const s = this.state;
    const r = s.cafeRating;
    const list = s.cafe.reviews ?? [];
    if (r === null) return [];
    const c = s.data.balance.cafe;
    const effect =
      list.length < 5
        ? ''
        : r >= c.rating_good
          ? t('UI_RATING_GOOD', { p: Math.round(c.rating_effect * 100) })
          : r <= c.rating_bad
            ? t('UI_RATING_BAD', { p: Math.round(c.rating_effect * 100) })
            : '';
    const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
    return [
      el(
        'div',
        { class: 'rating' },
        el('span', { class: 'rating-stars' }, stars(Math.round(r))),
        el('strong', {}, ` ${round1(r)}`),
        el('span', { class: 'muted' }, ` · ${t('UI_RATING_COUNT', { n: list.length })}`),
      ),
      effect ? el('p', { class: 'hint' }, effect) : el('span'),
      el('p', { class: 'hint' }, t('UI_RATING_HOW', { n: c.reviews_keep })),
      ...this.ratingTips(list),
      ...list
        .slice(-3)
        .reverse()
        .map((rv) =>
          el(
            'div',
            { class: 'review' },
            personPortrait(rv.sprite, 1),
            el(
              'div',
              { class: 'grow' },
              el('span', { class: 'rating-stars' }, stars(rv.stars)),
              el('p', {}, t(rv.key, { cat: rv.cat })),
            ),
          ),
        ),
    ];
  }

  /** Čo kazí hodnotenie – spočítané z posledných odkazov, aby hráč vedel, čo zlepšiť. */
  private ratingTips(list: { stars: number; key: string }[]): HTMLElement[] {
    const count = (k: string) => list.filter((r) => r.key === k).length;
    const tips: string[] = [];
    const notServed = count('REVIEW_NOT_SERVED');
    const sad = count('REVIEW_CAT_SAD');
    const plain = count('REVIEW_PLAIN');
    if (notServed) tips.push(t('UI_RATING_TIP_SERVE', { n: notServed }));
    if (sad) tips.push(t('UI_RATING_TIP_SAD', { n: sad }));
    if (plain) tips.push(t('UI_RATING_TIP_COZY', { n: plain }));
    if (!tips.length) return [];
    return [el('ul', { class: 'rating-tips' }, ...tips.map((x) => el('li', {}, x)))];
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
    if (cat.wish) needs.push(['💭', t('UI_NEED_WISH')]);
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
    } else {
      // Základné vyšetrenia: krátka hmatová minihra, ktorá ukáže, čo sa nájde
      const kind = EXAM_GAMES[tool];
      if (kind) {
        const exam = cat.conditions
          .filter((c) => !c.revealed)
          .map((c) => this.state.data.conditions.find((d) => d.id === c.id))
          .filter((d) => d?.reveal_tool === tool)
          .map((d) => ({ id: d!.id, name: t(d!.name_key) }));
        const stars = await this.runMinigame({
          kind: kind.kind,
          cat,
          title: t(kind.titleKey),
          exam,
        });
        if (stars === null) return;
      }
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
      exam_hand: 'MG_HAND_TITLE',
      exam_thermo: 'MG_THERMO_TITLE',
      exam_steth: 'MG_STETH_TITLE',
      exam_oto: 'MG_OTO_TITLE',
      brush: 'HOLD_BRUSH',
      treat: 'HOLD_TREAT',
      warm: 'MG_WARM_TITLE',
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
    this.confirmExit = false;
    if (kind === 'pause') this.game.setPaused(true);
    if (this.modal.hidden) this.game.playSound('open', 0.4);
    this.modal.hidden = false;
    this.renderModal();
  }

  private closeModal(): void {
    if (!this.modal.hidden) this.game.playSound('close', 0.4);
    this.modal.hidden = true;
    if (this.modalKind === 'pause' && this.title.hidden) this.game.setPaused(false);
    this.modalKind = null;
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
      case 'pause':
        box.classList.add('pause-box');
        box.append(...this.pauseContent());
        break;
      case 'station':
        box.append(...this.stationContent(), closeBtn);
        break;
      case 'event':
        box.append(...this.eventContent(closeBtn));
        break;
      case 'story':
        box.classList.add('story-box');
        box.append(...this.storyContent());
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

  /** Scénka z príbehu sa ukáže, keď hráč nič iné nerobí (žiadne okno, minihra ani menu). */
  /** Raz za sezónu privíta Halloween / Vianoce (GDD §7.3) – až keď hráč hrá. */
  private maybeGreetSeason(): void {
    if (!this.modal.hidden || !this.title.hidden || this.busy) return;
    const season = this.state.takeSeasonGreeting();
    if (!season) return;
    this.toast(t(`SEASON_${season.id.toUpperCase()}_HELLO`, { to: dayMonth(season.to) }));
    this.game.playSound('mewPurr', 0.5);
  }

  private maybeShowStory(): void {
    if (!this.modal.hidden || !this.title.hidden || this.busy) return;
    const beat = this.state.nextStoryBeat;
    if (!beat) return;
    this.storyBeat = beat;
    this.storyLine = 0;
    this.openModal('story');
  }

  /** Scénka dočítaná (alebo preskočená tlačidlom Späť) – už sa neukáže. */
  private finishStory(): void {
    const beat = this.storyBeat;
    this.storyBeat = null;
    this.closeModal();
    if (!beat) return;
    const hearts = this.state.markStorySeen(beat.id);
    this.game.saveNow();
    if (hearts > 0) {
      this.toast(t('TOAST_STORY_DONE', { n: hearts }));
      this.game.playSound('success', 0.5);
    }
  }

  /** Príbeh (GDD §8): jeden riadok naraz – portrét hovorcu, meno a text. */
  private storyContent(): HTMLElement[] {
    const s = this.state;
    const beat = this.storyBeat;
    const story = s.data.story;
    const line = beat?.lines[this.storyLine];
    if (!beat || !story || !line) return [];
    const [who, key] = line;
    const speaker = story.speakers[who];
    const last = this.storyLine >= beat.lines.length - 1;
    const next = button(
      last ? t('UI_CLOSE') : `${t('UI_STORY_NEXT')} ▸`,
      () => {
        if (!last) {
          this.storyLine += 1;
          this.renderModal();
          return;
        }
        this.finishStory();
      },
      { class: 'btn primary' },
    );
    return [
      el(
        'div',
        { class: 'story-line' },
        speaker ? personPortrait(speaker.sprite, 3) : null,
        el(
          'div',
          {},
          el('div', { class: 'sub' }, speaker ? t(speaker.name_key) : ''),
          el('p', {}, t(key, { cat: s.story.neighborCat ?? '' })),
        ),
      ),
      el('div', { class: 'story-dots' }, `${this.storyLine + 1} / ${beat.lines.length}`),
      next,
    ];
  }

  /** Udalosť: ponuka (prijať / odložiť) alebo prebiehajúca s postupom (GDD §7.3). */
  private eventContent(closeBtn: HTMLElement): HTMLElement[] {
    const s = this.state;
    const a = s.events.active;
    const id = a?.id ?? s.events.offer;
    const def = id ? s.eventDef(id) : undefined;
    if (!def) return [el('p', { class: 'muted' }, t('UI_EVENT_NONE')), closeBtn];
    const key = def.id.toUpperCase();
    const out: HTMLElement[] = [
      el('h2', {}, `${def.icon} ${t(`EVENT_${key}`)}`),
      el('p', {}, t(`EVENT_${key}_DESC`)),
      el(
        'p',
        { class: 'hint' },
        t('UI_EVENT_GOAL', {
          goal: t(`EVENT_${key}_GOAL`, { n: def.goal.target }),
          min: Math.round(def.duration_s / 60),
        }),
      ),
      el(
        'p',
        { class: 'hint' },
        t('UI_EVENT_REWARD', {
          money: def.money,
          rep: def.rep,
          bm: def.bonus_money,
          br: def.bonus_rep,
        }),
      ),
    ];
    if (a) {
      const p = s.eventProgress;
      const left = Math.max(0, Math.ceil((a.endsAt - s.now) / 60_000));
      if (p)
        out.push(
          el(
            'div',
            { class: 'stat' },
            el('span', {}, t(`EVENT_${key}_GOAL`, { n: p.need })),
            el('span', { class: 'val' }, `${p.have}/${p.need}`),
            el(
              'div',
              { class: 'bar' },
              el('i', { style: `width:${(p.have / p.need) * 100}%;background:#f2c14e` }),
            ),
          ),
          el('p', { class: 'hint' }, t('UI_EVENT_LEFT', { min: left })),
        );
      out.push(closeBtn);
      return out;
    }
    out.push(
      el(
        'div',
        { class: 'actions' },
        button(
          `✅ ${t('UI_EVENT_ACCEPT')}`,
          () => {
            if (s.acceptEvent()) this.closeModal();
          },
          { class: 'btn primary' },
        ),
        button(`⏳ ${t('UI_EVENT_LATER')}`, () => {
          s.declineEvent();
          this.closeModal();
        }),
      ),
    );
    return out;
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
      return [
        el('h2', {}, t('UI_VISITORS')),
        el('p', { class: 'muted' }, t('UI_NO_READY')),
        this.adoptionDayBlock(),
        close,
      ];

    const head = el(
      'div',
      { class: 'visitor-head' },
      personPortrait(visit.sprite),
      el(
        'div',
        {},
        el('div', { class: 'sub' }, t('UI_VISITOR_TITLE')),
        el('h2', {}, adopterName(def, visit.variant)),
        visit.friendOf
          ? el('p', { class: 'hint friend' }, t('UI_VISITOR_RETURNING', { friend: visit.friendOf }))
          : def.story
            ? el('p', { class: 'hint friend' }, t('UI_VISITOR_NEIGHBOR'))
            : null,
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
          el(
            'small',
            {},
            [m.uncertain ? t('UI_MATCH_UNCERTAIN') : '', m.glow ? `✨ ${t('UI_MATCH_GLOW')}` : '']
              .filter(Boolean)
              .join(' · '),
          ),
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
      this.adoptionDayBlock(),
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
      ...(this.state.campaignsUnlocked
        ? [{ id: 'city' as MenuTab, icon: '🏘️', label: t('MENU_CITY'), badge: 0 }]
        : []),
      { id: 'shop', icon: '🛒', label: t('MENU_SHOP'), badge: 0 },
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
        tb.label ? el('span', { class: 'tab-txt' }, tb.label) : '',
        tb.badge > 0 && this.menuTab !== tb.id ? el('span', { class: 'dot' }) : '',
      );
      b.addEventListener('click', () => {
        this.menuTab = tb.id;
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
              : this.menuTab === 'city'
                ? this.cityContent()
                : this.shopContent();
    return [bar, ...body];
  }

  /** Deň adopcií za ❤ (GDD §7.8): tlačidlo alebo odpočet. */
  private adoptionDayBlock(): HTMLElement {
    const s = this.state;
    const d = s.data.cosmetics?.adoption_day;
    if (!d) return el('span');
    const mmss = (ms: number) => {
      const sec = Math.ceil(ms / 1000);
      return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    };
    if (s.adoptionDayActive)
      return el(
        'p',
        { class: 'adoption-day on' },
        `🎉 ${t('UI_ADAY_ON', { t: mmss(s.adoptionDay.until - s.now) })}`,
      );
    const cd = s.adoptionDayCooldown;
    const anyReady = s.cats.some((c) => s.isReady(c));
    return el(
      'div',
      { class: 'adoption-day' },
      el('p', { class: 'hint' }, t('UI_ADAY_HINT', { min: Math.round(d.duration_s / 60) })),
      button(
        cd > 0
          ? `🎉 ${t('UI_ADAY_WAIT', { t: mmss(cd) })}`
          : `🎉 ${t('UI_ADAY_START', { price: d.price })}`,
        () => {
          if (s.startAdoptionDay()) this.renderModal();
        },
        {
          class: 'btn primary',
          disabled: cd > 0 || s.hearts < d.price || !anyReady,
          title: anyReady ? '' : t('UI_NO_READY'),
        },
      ),
    );
  }

  /** Želanie stálice v karte Opatera (GDD §7.8). */
  private wishBlock(cat: CatData): HTMLElement[] {
    const s = this.state;
    if (!cat.resident) return [];
    const rules = s.data.cosmetics?.wish_rules;
    const bond = cat.bond ?? 0;
    const bondLine = rules
      ? el(
          'p',
          { class: 'hint' },
          `💞 ${t('UI_BOND', { n: bond, max: rules.bond_max, p: Math.round(bond * rules.bond_donation * 100) })}`,
        )
      : el('span');
    const def = s.wishDef(cat.wish);
    if (!def) return [bondLine];
    const price = s.wishPrice(cat);
    return [
      el(
        'div',
        { class: 'wish' },
        el('span', { class: 'shop-icon' }, def.icon),
        el(
          'div',
          { class: 'grow' },
          el('strong', {}, t('UI_WISH_TITLE', { cat: cat.name })),
          el('p', {}, t(`WISH_${def.id.toUpperCase()}`)),
        ),
        button(
          `${price} ❤`,
          () => {
            if (s.grantWish(cat.id)) this.renderSheet();
          },
          { class: 'btn primary', disabled: s.hearts < price },
        ),
      ),
      bondLine,
    ];
  }

  /** Názov obvodu kampane: úroveň (mesto → okolie → kraj) a meno; po kraji ďalšie kolo. */
  private districtName(i: number): { tier: string; name: string } {
    const c = this.state.data.balance.campaigns;
    const tierIdx = Math.floor(i / c.districts_per_tier);
    const round = Math.floor(tierIdx / c.tiers);
    const tier = t(`CITY_TIER_${tierIdx % c.tiers}`);
    const name = t(`CITY_D_${tierIdx % c.tiers}_${i % c.districts_per_tier}`);
    return { tier: round > 0 ? `${tier} · ${t('CITY_ROUND', { n: round + 1 })}` : tier, name };
  }

  /** Kastračné kampane (GDD §7.7): obvody mesta, okolia a kraja, cena stále rastie. */
  private cityContent(): HTMLElement[] {
    const s = this.state;
    const c = s.data.balance.campaigns;
    const d = s.campaignDistrict;
    const { tier, name } = this.districtName(d);
    const a = s.campaigns.active;
    const price = s.campaignPrice;
    const per = c.per_district;
    const tierStart = d - (d % c.districts_per_tier);
    const dots = (k: number) => '●'.repeat(k) + '○'.repeat(per - k);
    const out: HTMLElement[] = [
      el('p', { class: 'hint' }, t('UI_CITY_INTRO')),
      el(
        'div',
        { class: 'campaign-card' },
        el('span', { class: 'shop-icon' }, '🏘️'),
        el(
          'div',
          { class: 'grow' },
          el('strong', {}, name),
          el('p', { class: 'hint' }, `${tier} · ${dots(s.campaignDistrictDone)}`),
        ),
      ),
    ];
    if (a) {
      const left = Math.max(0, a.endsAt - s.now);
      const total = s.campaignDurationMs;
      const pct = Math.round(100 - (left / total) * 100);
      const sec = Math.ceil(left / 1000);
      out.push(
        el(
          'p',
          {},
          t('UI_CITY_RUNNING', {
            t: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`,
          }),
        ),
        el('div', { class: 'bar' }, el('i', { style: `width:${pct}%;background:var(--ui-good)` })),
      );
    } else {
      out.push(
        button(
          `✂️ ${t('UI_CITY_START', { price })}`,
          () => {
            if (s.startCampaign()) this.renderModal();
          },
          { class: 'btn primary', disabled: s.money < price },
        ),
      );
    }
    out.push(
      el(
        'p',
        { class: 'hint' },
        t('UI_CITY_REWARD', {
          rep: Math.round((c.rep + c.rep_step * s.campaigns.done) * s.campaignRewardMult),
          h: Math.round(c.hearts * s.campaignRewardMult),
          dh: Math.round(c.district_hearts * s.campaignRewardMult),
          min: Math.round(s.campaignDurationMs / 60000),
        }),
      ),
      el(
        'p',
        { class: 'hint' },
        t('UI_CITY_BONUS', { n: s.campaignsCleared, p: Math.round(s.campaignAdopterBonus * 100) }),
      ),
    );
    // prestíž: nový program od mesta, trvalé bonusy (GDD §7.7)
    const pr = s.campaignPrestige;
    if (pr > 0)
      out.push(
        el(
          'p',
          { class: 'hint' },
          `🏅 ${t('UI_PRESTIGE_LINE', {
            n: pr,
            fee: Math.round((s.prestigeFeeMult - 1) * 100),
            rew: Math.round((s.campaignRewardMult - 1) * 100),
          })}`,
        ),
      );
    const tiers = s.campaignTiersDone;
    if (tiers > 0 && !a) {
      const box = el(
        'div',
        { class: 'prestige' },
        el('strong', {}, `🏅 ${t('UI_PRESTIGE_TITLE')}`),
        el(
          'p',
          { class: 'hint' },
          t('UI_PRESTIGE_DESC', {
            n: tiers,
            fee: Math.round(c.prestige_fee * 100 * tiers),
            rew: Math.round(c.prestige_reward * 100 * tiers),
          }),
        ),
      );
      if (this.confirmPrestige)
        box.append(
          el(
            'div',
            { class: 'footer' },
            button(t('UI_CANCEL'), () => {
              this.confirmPrestige = false;
              this.renderModal();
            }),
            button(
              t('UI_PRESTIGE_YES'),
              () => {
                this.confirmPrestige = false;
                s.prestigeCampaigns();
                this.renderModal();
              },
              { class: 'btn primary' },
            ),
          ),
        );
      else
        box.append(
          button(`🏅 ${t('UI_PRESTIGE_BTN', { n: tiers })}`, () => {
            this.confirmPrestige = true;
            this.renderModal();
          }),
        );
      out.push(box);
    }
    // obvody aktuálnej úrovne
    const list = el('div', { class: 'districts' });
    for (let i = tierStart; i < tierStart + c.districts_per_tier; i++) {
      const st = i < d ? 'done' : i === d ? 'now' : 'todo';
      list.append(
        el(
          'div',
          { class: `district ${st}` },
          el('span', {}, st === 'done' ? '✓' : st === 'now' ? '✂️' : '·'),
          el('span', { class: 'grow' }, this.districtName(i).name),
          el(
            'span',
            { class: 'muted' },
            st === 'done' ? dots(per) : st === 'now' ? dots(s.campaignDistrictDone) : '',
          ),
        ),
      );
    }
    out.push(el('h3', {}, tier), list);
    return out;
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
            el('span', { class: 'muted' }, `${t('UI_REWARD')}: ${eur(def.money)} · ★ ${def.rep}`),
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

  /** Názov strany albumu pre oznámenia a nadpisy. */
  private albumPageName(id: string): string {
    if (id === 'fixed') return t('UI_ALBUM_FIXED');
    if (id === 'rare') return t('UI_ALBUM_RARE');
    if (id.startsWith('season:')) return t(`SEASON_${id.slice(7).toUpperCase()}`);
    const breed = this.state.data.breeds.find((b) => `breed:${b.id}` === id);
    return breed ? t(breed.name_key) : id;
  }

  /** Nadpis strany albumu – s fajkou, keď je celá (a odmenená). */
  private albumHeader(id: string, icon = ''): HTMLElement {
    const done = this.state.albumPageDone(id);
    return el(
      'div',
      { class: 'album-breed' },
      `${icon}${this.albumPageName(id)}`,
      done ? el('span', { class: 'album-done', title: t('UI_ALBUM_PAGE_DONE') }, ' ✅') : '',
    );
  }

  private albumCell(
    entry: AlbumEntry | undefined,
    label: string,
    empty: string,
    rare = false,
  ): HTMLElement {
    if (!entry)
      return el('div', { class: 'album-cell empty', title: label, 'aria-label': label }, empty);
    const cell = el(
      'button',
      {
        class: rare ? 'album-cell rare' : 'album-cell',
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
        rare
          ? `✨ ${entry.name} – ${label}`
          : `${t(entry.how === 'adopted' ? 'UI_ALBUM_ADOPTED' : 'UI_ALBUM_RESIDENT', { cat: entry.name })} (${label})`,
      ),
    );
    return cell;
  }

  private albumContent(): HTMLElement[] {
    const s = this.state;
    const data = s.data;
    const filled = s.albumFilled;
    const grid = el('div', { class: 'album' });
    const regular = data.coats.filter((c) => !c.special);
    // Bežné plemená majú riadok, plemená s pevnou farbou sú spolu v jednom riadku na konci
    for (const breed of data.breeds.filter((b) => !b.coat)) {
      grid.append(this.albumHeader(`breed:${breed.id}`));
      for (const coat of regular)
        grid.append(
          this.albumCell(
            s.album[GameState.albumKey(breed.id, coat.id)],
            `${t(breed.name_key)} · ${t(coat.name_key)}`,
            '?',
          ),
        );
    }
    grid.append(this.albumHeader('fixed'));
    for (const breed of data.breeds.filter((b) => b.coat)) {
      const coat = data.coats.find((c) => c.id === breed.coat);
      grid.append(
        this.albumCell(
          s.album[GameState.albumKey(breed.id, breed.coat ?? '')],
          `${t(breed.name_key)} · ${t(coat?.name_key ?? '')}`,
          '?',
        ),
      );
    }
    // strana vzácností (GDD §7.2)
    grid.append(this.albumHeader('rare', '✨ '));
    for (const mark of Late.RARE_MARKS)
      grid.append(
        this.albumCell(s.album[`special:${mark}`], t(`RARE_${mark.toUpperCase()}`), '✨', true),
      );
    // sezónne strany (GDD §7.3) – mačky prichádzajú iba v sezóne
    const season = s.season;
    for (const def of data.balance.seasons?.list ?? []) {
      const coats = Late.seasonCoats(data, def.id);
      if (!coats.length) continue;
      grid.append(this.albumHeader(`season:${def.id}`, `${def.icon} `));
      if (season?.id !== def.id && !coats.some((c) => s.album[`season:${c.id}`]))
        grid.append(
          el(
            'p',
            { class: 'hint album-note' },
            t('UI_ALBUM_SEASON_WHEN', { from: dayMonth(def.from), to: dayMonth(def.to) }),
          ),
        );
      for (const coat of coats)
        grid.append(this.albumCell(s.album[`season:${coat.id}`], t(coat.name_key), def.icon, true));
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
      el(
        'p',
        { class: 'hint' },
        t('UI_ALBUM_PAGES', {
          hearts: data.cosmetics?.hearts.album_page ?? 0,
          money: data.balance.rewards.album_page_money,
        }),
      ),
      grid,
    ];
  }

  /** Ocenenia po poslednej úrovni (GDD §6.1.1): počet, postup k ďalšiemu a posledné. */
  private honorsInfo(): HTMLElement[] {
    const s = this.state;
    const data = s.data;
    const h = data.balance.honors;
    if (!h) return [];
    const n = s.late.honors;
    const from = Late.honorRep(data, n);
    const pct = Math.min(100, ((s.reputation - from) / h.every) * 100);
    return [
      el(
        'div',
        { class: 'row' },
        el('strong', {}, t('UI_HONORS', { n })),
        n > 0
          ? el(
              'span',
              { class: 'muted' },
              t('UI_HONOR_LAST', { title: t(Late.honorTitleKey(data, n)) }),
            )
          : '',
      ),
      el('div', { class: 'bar' }, el('i', { style: `width:${pct}%;background:#c9a0e8` })),
      el(
        'p',
        { class: 'hint' },
        t('UI_HONOR_NEXT', {
          every: h.every,
          hearts: h.hearts,
          money: h.money,
          rep: Late.honorRep(data, n + 1),
        }),
      ),
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
      ...(next ? [] : this.honorsInfo()),
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
            : buy(eur(price), price, () => s.buyEquipment(def.id)),
      );
    });

    const tabs: { id: ShopTab; icon: string; label: string }[] = [
      { id: 'build', icon: '🏗️', label: t('UI_SHOP_BUILD') },
      { id: 'equipment', icon: '🧰', label: t('UI_SHOP_EQUIP') },
      { id: 'staff', icon: '👩‍⚕️', label: t('UI_SECTION_STAFF') },
      { id: 'decor', icon: '🪴', label: t('UI_SECTION_DECOR') },
      { id: 'cosmetics', icon: '❤️', label: t('UI_SHOP_COSMETICS') },
    ];
    const bar = el('div', { class: 'tabs shop-tabs', role: 'tablist' });
    for (const tb of tabs) {
      const b = el(
        'button',
        {
          class: `tab${this.shopTab === tb.id ? ' active' : ''}`,
          type: 'button',
          role: 'tab',
          title: tb.label,
          'aria-label': tb.label,
          'aria-selected': this.shopTab === tb.id ? 'true' : 'false',
        },
        el('span', { class: 'tab-ico' }, tb.icon),
        el('span', { class: 'tab-txt' }, tb.label),
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
    if (this.shopTab === 'cosmetics') return [levelCard, bar, ...this.cosmeticsContent()];
    return [levelCard, bar, ...this.decorContent()];
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

  /**
   * Pošta: pripnuté na nástenke, najnovšie naplno, staršie ako malé náhľady
   * (ťuknutím sa rozbalia). Pri stovkách adopcií sa okno nezahltí.
   */
  private postcardsContent(): HTMLElement[] {
    const s = this.state;
    const cards = s.postcards;
    if (cards.length === 0) return [el('p', { class: 'muted' }, t('UI_NO_POSTCARDS'))];
    const max = s.data.balance.rewards.postcard_pins;
    const out: HTMLElement[] = [
      el('p', { class: 'hint' }, t('UI_PC_SUMMARY', { n: cards.length, p: s.pinnedCount, max })),
    ];
    const pinned = cards.filter((c) => c.pinned);
    const rest = cards.filter((c) => !c.pinned);
    // nové (nevidené) vždy naplno, inak aspoň posledných 6
    const fresh = Math.max(6, rest.filter((c) => !c.postcardSeen).length);
    const recent = rest.slice(0, fresh);
    const older = rest.slice(fresh);
    if (pinned.length) {
      out.push(el('h3', { class: 'pc-head' }, t('UI_PC_PINNED')));
      out.push(...pinned.map((r) => this.postcard(r)));
    }
    out.push(el('h3', { class: 'pc-head' }, t('UI_PC_RECENT')));
    out.push(...recent.map((r) => this.postcard(r)));
    if (older.length) {
      out.push(el('h3', { class: 'pc-head' }, t('UI_PC_OLDER')));
      const grid = el('div', { class: 'pc-grid' });
      for (const rec of older) {
        if (this.openPostcard === rec.cat.id) {
          const big = this.postcard(rec);
          big.classList.add('pc-open');
          grid.append(big);
          continue;
        }
        const thumb = el(
          'button',
          { class: 'pc-thumb', type: 'button', 'aria-label': rec.cat.name },
          catPortrait(rec.cat, 2),
          el('span', {}, rec.cat.name),
        );
        thumb.addEventListener('click', () => {
          this.openPostcard = rec.cat.id;
          this.renderModal();
        });
        grid.append(thumb);
      }
      out.push(grid);
    }
    out.push(
      el('p', { class: 'hint' }, t('UI_PC_KEEP_HINT', { n: s.data.balance.rewards.postcard_keep })),
    );
    for (const rec of cards) s.markPostcardSeen(rec);
    return out;
  }

  private postcard(rec: AdoptionRecord): HTMLElement {
    const s = this.state;
    const def = s.data.adopters.find((d) => d.id === rec.adopterDefId);
    const person = personPortrait(rec.adopterSprite, 3);
    person.style.left = '30%';
    const cat = catPortrait(rec.cat, 3);
    cat.style.left = '48%';
    cat.style.filter = '';
    const text = postcardText(rec, def, s.data.balance.match.perfect);
    const full = !rec.pinned && s.pinnedCount >= s.data.balance.rewards.postcard_pins;
    const pin = button(
      rec.pinned ? t('UI_PC_UNPIN') : t('UI_PC_PIN'),
      () => {
        if (s.togglePin(rec.cat.id)) this.renderModal();
      },
      {
        class: `btn pc-pin${rec.pinned ? ' primary' : ''}`,
        disabled: full,
        title: full ? t('UI_PC_PINS_FULL') : '',
      },
    );
    return el(
      'div',
      { class: `postcard${rec.pinned ? ' pinned' : ''}` },
      el('div', { class: 'scene' }, person, cat),
      el('p', {}, text.main),
      text.ps ? el('p', { class: 'pc-ps' }, text.ps) : null,
      el(
        'div',
        { class: 'pc-foot' },
        el(
          'p',
          { class: 'from' },
          t('UI_POSTCARD_FROM', { who: def ? adopterName(def, rec.adopterVariant) : '' }),
        ),
        pin,
      ),
    );
  }
}
