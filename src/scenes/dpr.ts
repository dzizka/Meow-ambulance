/**
 * Hustota pixelov displeja. Plátno sa kreslí v plnom rozlíšení displeja
 * (napr. 3× na iPhone), inak by prehliadač obraz zväčšoval a texty by boli rozmazané.
 * Rozloženie sa počíta v CSS pixeloch a násobí sa DPR. Strop 3 kvôli výkonu.
 */
export const DPR = Math.min(3, Math.max(1, window.devicePixelRatio || 1));

/** Veľkosť okna v pixeloch plátna. */
export const canvasSize = (): { width: number; height: number } => ({
  width: Math.round(window.innerWidth * DPR),
  height: Math.round(window.innerHeight * DPR),
});
