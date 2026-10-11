import Phaser from 'phaser';

/**
 * Geometria miestností pre mačky: kadiaľ nechodia (pôdorysy nábytku) a kde by ich
 * vysoký nábytok zakryl (tam si nesadnú ani nelahnú). Plní ju garáž, kaviareň a vybavenie.
 */
export interface WorldGeom {
  obstacles: Phaser.Geom.Rectangle[];
  hideZones: Phaser.Geom.Rectangle[];
}

/** Pôdorys pri zemi – tadiaľ mačky nechodia. */
export function addObstacle(
  geom: WorldGeom,
  x: number,
  bottomY: number,
  width: number,
  depth: number,
): void {
  const pad = 3;
  geom.obstacles.push(
    new Phaser.Geom.Rectangle(
      x - width / 2 - pad,
      bottomY - depth - pad,
      width + pad * 2,
      depth + pad * 2,
    ),
  );
}

/**
 * Predmet stojaci na zemi (origin 0.5, 1): pôdorys + miesto za ním, kde by mačku nebolo vidieť
 * (mačka s labkami v tomto obdĺžniku je za predmetom). Nízke predmety mačku nezakryjú.
 */
export function addProp(
  geom: WorldGeom,
  x: number,
  bottomY: number,
  width: number,
  height: number,
  footprint: number,
): void {
  if (footprint > 0) addObstacle(geom, x, bottomY, width, footprint);
  const behind = height - footprint;
  if (height >= 20 && behind >= 10) {
    geom.hideZones.push(
      new Phaser.Geom.Rectangle(x - width / 2 - 6, bottomY - height, width + 12, behind + 4),
    );
  }
}
