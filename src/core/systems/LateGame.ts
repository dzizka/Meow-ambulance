import type { CoatDef, GameData, RareMark, SeasonDef } from '../../data/types';

/** Neskorá hra (GDD §6.1.1, §7.1, §7.3): sezóny, strany albumu a ocenenia. Bez Phaseru. */

/** Vzácne znaky v poradí, v akom sú na strane vzácností. */
export const RARE_MARKS: readonly RareMark[] = ['hetero', 'poly', 'tortie_male'];

const monthDay = (d: Date): string =>
  `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Sezóna, ktorá práve beží podľa skutočného dátumu (rozsah môže prejsť cez Nový rok). */
export function seasonAt(data: GameData, date: Date): SeasonDef | null {
  const md = monthDay(date);
  for (const s of data.balance.seasons?.list ?? []) {
    const inside = s.from <= s.to ? md >= s.from && md <= s.to : md >= s.from || md <= s.to;
    if (inside) return s;
  }
  return null;
}

/** Kľúč sezóny s rokom jej začiatku (Vianoce v januári patria k minulému roku). */
export function seasonKey(season: SeasonDef, date: Date): string {
  const wrapped = season.from > season.to && monthDay(date) <= season.to;
  return `${season.id}:${date.getFullYear() - (wrapped ? 1 : 0)}`;
}

export function seasonCoats(data: GameData, seasonId: string): CoatDef[] {
  return data.coats.filter((c) => c.season === seasonId);
}

/** Kľúč políčka albumu – sezónne mačky majú vlastnú stranu. */
export function albumKeyFor(data: GameData, breedId: string, coatId: string): string {
  const coat = data.coats.find((c) => c.id === coatId);
  return coat?.season ? `season:${coatId}` : `${breedId}:${coatId}`;
}

/** Strana albumu: plemeno s ľubovoľnou farbou, plemená s pevnou farbou, vzácnosti, sezóna. */
export interface AlbumPage {
  id: string;
  keys: string[];
}

export function albumPages(data: GameData): AlbumPage[] {
  const regular = data.coats.filter((c) => !c.special);
  const pages: AlbumPage[] = data.breeds
    .filter((b) => !b.coat)
    .map((b) => ({ id: `breed:${b.id}`, keys: regular.map((c) => `${b.id}:${c.id}`) }));
  pages.push({
    id: 'fixed',
    keys: data.breeds.filter((b) => b.coat).map((b) => `${b.id}:${b.coat}`),
  });
  pages.push({ id: 'rare', keys: RARE_MARKS.map((m) => `special:${m}`) });
  for (const s of data.balance.seasons?.list ?? [])
    pages.push({
      id: `season:${s.id}`,
      keys: seasonCoats(data, s.id).map((c) => `season:${c.id}`),
    });
  return pages.filter((p) => p.keys.length > 0);
}

/** Koľko ocenení patrí k danej reputácii (každých `every` ★ nad poslednou úrovňou). */
export function honorsFor(data: GameData, reputation: number): number {
  const h = data.balance.honors;
  const top = data.balance.levels[data.balance.levels.length - 1]?.rep ?? 0;
  if (!h || reputation < top) return 0;
  return Math.floor((reputation - top) / h.every);
}

/** Od koľkých ★ je n-té ocenenie (1 = prvé). */
export function honorRep(data: GameData, n: number): number {
  const top = data.balance.levels[data.balance.levels.length - 1]?.rep ?? 0;
  return top + n * (data.balance.honors?.every ?? 0);
}

/** Kľúč názvu n-tého ocenenia – názvy sa opakujú dokola. */
export function honorTitleKey(data: GameData, n: number): string {
  const titles = data.balance.honors?.titles ?? 1;
  return `HONOR_${((n - 1) % titles) + 1}`;
}
