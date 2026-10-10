# Technické konvencie

## Technológie
- **TypeScript** (`strict: true`) + **Phaser** (WebGL renderer, fallback Canvas)
- **Vite** – vývojový server a build
- **Vitest** – testy hernej logiky
- **Tiled** – editor máp útulku (export JSON)
- Obal pre PC: **Tauri**; pre mobil: **Capacitor** (pridajú sa v M2, kód hry sa kvôli nim nemení)
- Node.js LTS, správca balíkov `npm`

Presné verzie sa zafixujú v `package.json` pri M0.

## Zobrazenie (pixel-art)
- Mriežka **32×32 px**.
- Základné rozlíšenie hernej plochy **480×270** (16:9), škálovanie celočíselným násobkom (`Phaser.Scale.FIT` + `pixelArt: true`, `roundPixels: true`).
- Na výšku (mobil) sa UI preskladá – HUD dole, karty ako vysúvacie panely. Herná plocha ostáva 16:9 s možnosťou posúvania a priblíženia prstami.
- UI text (karty, dialógy) sa vykresľuje vo vyššom rozlíšení než herná plocha, aby bol čitateľný na mobile.

## Štruktúra repozitára
```
index.html
package.json, tsconfig.json, vite.config.ts
public/                 statické súbory (kopírujú sa do buildu bez zmeny)
  assets/
    sprites/cats/       mačky
    sprites/interior/   nábytok, steny, podlahy
    sprites/clinic/     veterinárne vybavenie
    sprites/people/     adoptéri, personál
    ui/                 panely, tlačidlá, ikony
    postcards/          ilustrácie pohľadníc
    maps/               Tiled mapy (.json) a tilesety
    audio/music/
    audio/sfx/
    fonts/
  data/                 JSON herné dáta (balansovanie bez kódu)
src/
  main.ts               konfigurácia Phaseru
  core/                 čistá logika BEZ Phaseru (testovateľná)
    GameState.ts, TimeManager.ts, CatRegistry.ts, EventBus.ts, SaveManager.ts
    systems/            CatGenerator.ts, MatchCalculator.ts, Economy.ts
  data/                 typy (CatData, TraitData…) a načítanie JSON
  scenes/               Phaser scény – iba zobrazenie a vstup
    minigames/          jedna scéna = jedna minihra
  ui/                   znovupoužiteľné UI komponenty
  audio/                AudioManager.ts
  i18n/                 sk.json, en.json, t.ts
tests/                  Vitest testy logiky
licenses/               texty licencií stiahnutých assetov (neidú do buildu)
docs/                   dizajn a plánovanie
```

## Konvencie kódu
- Súbory s triedami `PascalCase.ts`, ostatné `camelCase.ts`; premenné a funkcie `camelCase`, konštanty `UPPER_SNAKE_CASE`.
- Žiadne `any`. Herné dáta majú typy v `src/data/`.
- Udalosti v minulom čase: `catAdopted`, `dayEnded`.
- Žiadne „magické čísla" – balans patrí do `public/data/*.json`.
- Žiadny text v kóde – iba kľúče prekladu: `t('TRAIT_SHY')`.
- **`src/core/` nesmie importovať Phaser.** Scény čítajú stav z `core` a volajú jeho akcie.
- Formátovanie: Prettier, kontrola: ESLint (nastaví sa v M0).

## Minihry – rozhranie
Každá minihra je Phaser scéna, ktorá dostane mačku a vráti hodnotenie:
```ts
export interface MinigameResult { stars: 1 | 2 | 3 }   // nikdy 0 – liečba vždy uspeje
// spustenie:  this.scene.launch('TickRemoval', { catId })
// koniec:     this.events.emit('minigameFinished', result)
```
Ovládanie: iba ukazovateľ (myš = dotyk). Žiadna minihra nevyžaduje klávesnicu ani multi-touch.

## Ukladanie
- Web a Tauri: `localStorage` (kľúč `meow-ambulance:save:<slot>`); Capacitor: plugin Preferences/Filesystem – za spoločným rozhraním `SaveStorage`.
- Pole `saveVersion`; pri zmene formátu sa pridá migračná funkcia, staré savy nesmú prestať fungovať.

## Testy a CI
- Vitest pre `src/core/`: generovanie mačky, výpočet zhody, ekonomika, migrácie savov.
- GitHub Actions: `npm ci && npm run lint && npm test && npm run build` pri každom PR.
- Po merge do `main`: nasadenie na GitHub Pages → hrateľná verzia na odkaze aj na mobile.
- Minihry a UI sa testujú ručne podľa checklistu v PR – **vždy aj na telefóne**.
