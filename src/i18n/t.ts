import sk from './sk.json';
import en from './en.json';

export type Lang = 'sk' | 'en';
type Dict = Record<string, string>;

const dictionaries: Record<Lang, Dict> = { sk, en };

/** Slovenčina pre SK/CZ prehliadače, inak angličtina. */
export let lang: Lang =
  typeof navigator !== 'undefined' && /^(sk|cs)/i.test(navigator.language) ? 'sk' : 'en';

export function setLang(next: Lang): void {
  lang = next;
}

/** Preklad kľúča s náhradou {premenných}. Chýbajúci kľúč sa vráti tak, ako je. */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const text = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
