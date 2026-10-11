import sk from './sk.json';
import en from './en.json';

export type Lang = 'sk' | 'en';
type Dict = Record<string, string>;

const dictionaries: Record<Lang, Dict> = { sk, en };

const LANG_KEY = 'meow:lang';

/** Jazyk zvolený v nastaveniach, inak slovenčina pre SK/CZ prehliadače, inak angličtina. */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'sk' || saved === 'en') return saved;
  } catch {
    // súkromné okno a pod. – použije sa jazyk prehliadača
  }
  return typeof navigator !== 'undefined' && /^(sk|cs)/i.test(navigator.language) ? 'sk' : 'en';
}

export let lang: Lang = initialLang();

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
