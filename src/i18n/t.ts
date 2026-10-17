import en from './en.json';
import sk from './sk.json';
import de from './de.json';
import es from './es.json';
import zh from './zh.json';
import ko from './ko.json';

/** Jazyky hry. Angličtina je hlavná – chýbajúci preklad sa vždy zobrazí po anglicky. */
export const LANGS = ['en', 'sk', 'de', 'es', 'zh', 'ko'] as const;
export type Lang = (typeof LANGS)[number];
type Dict = Record<string, string>;

/** Názov jazyka v ňom samom (pre výber v nastaveniach). */
export const LANG_NAMES: Record<Lang, string> = {
  en: 'English',
  sk: 'Slovenčina',
  de: 'Deutsch',
  es: 'Español',
  zh: '简体中文',
  ko: '한국어',
};

const dictionaries: Record<Lang, Dict> = { en, sk, de, es, zh, ko };

const LANG_KEY = 'meow:lang';

const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

/** Jazyk prehliadača → jazyk hry (čeština → slovenčina), inak null. */
export function langFromLocale(locale: string): Lang | null {
  const code = locale.toLowerCase().split(/[-_]/)[0] ?? '';
  if (code === 'cs') return 'sk';
  return isLang(code) ? code : null;
}

/** Jazyk zvolený v nastaveniach, inak prvý podporovaný jazyk prehliadača, inak angličtina. */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // súkromné okno a pod. – použije sa jazyk prehliadača
  }
  if (typeof navigator === 'undefined') return 'en';
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const l of prefs) {
    const found = l && langFromLocale(l);
    if (found) return found;
  }
  return 'en';
}

export let lang: Lang = initialLang();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

/** Jazyk pre Intl (dátumy, čísla). */
const LOCALES: Record<Lang, string> = {
  en: 'en-GB',
  sk: 'sk-SK',
  de: 'de-DE',
  es: 'es-ES',
  zh: 'zh-CN',
  ko: 'ko-KR',
};
export const locale = LOCALES[lang];

/** Suma v eurách podľa zvyklostí jazyka: „€70“ (EN, ZH, KO) alebo „70 €“ (SK, DE, ES). */
export function eur(n: number | string): string {
  return lang === 'en' || lang === 'zh' || lang === 'ko' ? `€${n}` : `${n} €`;
}

/** Zmení jazyk a zapamätá si ho (hra sa potom znovu načíta, aby sa preložilo všetko). */
export function setLang(next: Lang): void {
  lang = next;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // nevadí – jazyk platí aspoň do zatvorenia
  }
}

/** Preklad kľúča s náhradou {premenných}. Chýbajúci kľúč sa vráti tak, ako je. */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const text = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
