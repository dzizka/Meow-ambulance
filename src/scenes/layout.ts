/** Veľkosť herného sveta (garáž) v pixeloch pixel-artu. */
export const WORLD_W = 480;
export const WORLD_H = 270;

/** Rozmery miestnosti (garáž aj kaviareň) v pixeloch pixel-artu, relatívne k ľavému okraju miestnosti. */
export const ROOM = { x: 16, y: 6, w: 448, wallH: 64, floorH: 192 } as const;
export const FLOOR_TOP = ROOM.y + ROOM.wallH;
/** Kaviareň je vo svete hneď vedľa garáže (GDD §5.5). */
export const CAFE_X = WORLD_W;
/** Komunitný útulok je tretia budova vedľa kaviarne (GDD §6.2). */
export const SHELTER_X = WORLD_W * 2;
export type Room = 'garage' | 'cafe' | 'shelter';
export const roomX = (room: Room): number =>
  room === 'cafe' ? CAFE_X : room === 'shelter' ? SHELTER_X : 0;
/** V ktorej miestnosti je bod sveta. */
export const roomAt = (x: number): Room =>
  x >= SHELTER_X ? 'shelter' : x >= CAFE_X ? 'cafe' : 'garage';

export interface Layout {
  width: number;
  height: number;
  portrait: boolean;
  /** Priblíženie sveta (1 px pixel-artu = zoom px obrazovky). */
  zoom: number;
  /** Výška oblasti so svetom na obrazovke. */
  worldScreenH: number;
  /** Panel s kartou mačky v pixeloch obrazovky. */
  panel: { x: number; y: number; w: number; h: number };
  /** Základná veľkosť písma UI. */
  font: number;
}

/**
 * Na šírku: garáž cez celú obrazovku, karta mačky sa vysunie sprava.
 * Na výšku: garáž hore, karta mačky pod ňou (GDD §9.3 – ovládanie jednou rukou).
 */
export function computeLayout(width: number, height: number): Layout {
  const portrait = height > width;
  // Na výšku je garáž väčšia ako šírka displeja – posúva sa prstom do strán
  // Karta mačky pod garážou potrebuje ~405 px, aby sa vošla bez rolovania – na nižších
  // displejoch je garáž o to menšia (najmenej 36 % výšky).
  const maxWorldH = Math.max(height * 0.36, Math.min(height * 0.5, height - 405));
  const zoom = portrait
    ? Math.max(width / WORLD_W, Math.min(maxWorldH / WORLD_H, (width / WORLD_W) * 2))
    : Math.max(0.5, Math.min(width / WORLD_W, height / WORLD_H));
  const worldScreenH = Math.round(WORLD_H * zoom);
  const font = Math.round(Math.min(20, Math.max(13, Math.min(width, height) / 26)));

  const panel = portrait
    ? { x: 10, y: worldScreenH + 8, w: width - 20, h: height - worldScreenH - 18 }
    : {
        w: Math.round(Math.min(300, Math.max(220, width * 0.32))),
        x: 0,
        y: Math.round(font * 3.2),
        h: Math.round(height - font * 3.2 - 10),
      };
  if (!portrait) panel.x = width - panel.w - 10;

  return { width, height, portrait, zoom, worldScreenH, panel, font };
}
