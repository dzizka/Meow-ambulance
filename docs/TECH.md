# Technické konvencie

## Technológie
- **TypeScript** (`strict: true`) + **Phaser** (WebGL renderer, fallback Canvas)
- **Vite** – vývojový server a build
- **Vitest** – testy hernej logiky
- **Tiled** – editor máp útulku (export JSON)
- Obal pre PC: **Tauri**; pre mobil: **Capacitor** (pridajú sa v M2, kód hry sa kvôli nim nemení)
- Node.js LTS, správca balíkov `npm`

Verzie (M0, október 2026): Phaser 4.2, TypeScript 6.0, Vite 8.3, Vitest 5.0, ESLint 10 – presne v `package.json` / `package-lock.json`.

## Zobrazenie (pixel-art)
- Mriežka **32×32 px**, herný svet garáže **480×270 px** (`src/scenes/layout.ts`).
- Plátno má veľkosť okna (`Phaser.Scale.RESIZE`, `pixelArt: true`, `roundPixels: true`). Kamera sveta si sama vypočíta priblíženie (`computeLayout`).
- **Na šírku:** garáž cez celú obrazovku, karta mačky sa zobrazí vpravo.
- **Na výšku:** garáž v hornej polovici, väčšia ako displej – posúva sa ťahaním prstom; karta mačky pod ňou, ovládanie rýchlosti pod garážou.
- UI (scéna `UI`) sa kreslí v pixeloch obrazovky bez priblíženia a s `resolution = devicePixelRatio`, aby bol text ostrý aj na mobile.
- Statické pozadie (podlaha, steny, výzdoba) sa skladá raz do jednej canvas textúry – žiadne škáry medzi dlaždicami pri neceločíselnom priblížení.
- Výrezy nábytku z hárkov sú v `src/data/frames.ts`.

## Štruktúra repozitára
```
index.html
package.json, tsconfig.json, vite.config.ts
public/                 statické súbory (kopírujú sa do buildu bez zmeny)
  assets/               ← Git podmodul: súkromný repozitár Meow-ambulance-offline
    _source/            pôvodné zipy (nejdú do buildu)
    licenses/           texty licencií (nejdú do buildu)
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

## Podmodul s assetmi
- Klonovanie: `git clone --recurse-submodules …`, aktualizácia: `git submodule update --remote public/assets`.
- Nové assety sa commitujú **najprv** v podmodule (`public/assets/`), potom sa vo verejnom repozitári commitne posun podmodulu.
- Build (`vite`) nesmie kopírovať `public/assets/_source/` a `public/assets/licenses/` – vyfiltruje sa v `vite.config.ts`.
