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
- Plátno má veľkosť okna **× DPR** (`Phaser.Scale.NONE`, `zoom: 1/DPR`, `src/scenes/dpr.ts`) – kreslí sa v plnom rozlíšení displeja, takže texty a pixel-art sú na mobile ostré. Pri zmene okna `game.scale.resize` v `main.ts`.
- Rozloženie (`computeLayout`) sa počíta v **CSS pixeloch** (rovnako ako HTML rozhranie); kamera a minihry ho násobia `DPR`. Pevné rozmery v minihrách (písmo, okraje) písať ako `px * DPR`, ostatné relatívne k `S`.
- Texty na plátne majú `resolution` 1 (plátno už je v plnom rozlíšení). `pixelArt: true`, `roundPixels: true`.
- Tieň pod mačkou: labky sú v snímke na riadku ~24–26, preto `FEET_OFFSET` v `CatSprite.ts`.
- **Na šírku:** garáž cez celú obrazovku, karta mačky sa zobrazí vpravo.
- **Na výšku:** garáž v hornej polovici, väčšia ako displej – posúva sa ťahaním prstom; karta mačky a zoznam mačiek pod ňou.
- **Rozhranie je HTML/CSS** (`src/ui/`) položené nad plátnom – karty, zoznamy, dialógy, oznámenia. Phaser kreslí iba svet a minihry (`MinigameScene`). Počas minihry sa HTML rozhranie skryje (trieda `body.minigame`).
- Portréty mačiek a ľudí v HTML sú výrezy zo sprite hárkov cez CSS (`background-position`, `image-rendering: pixelated`).
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
- Udalosti v minulom čase: `catAdopted`, `reportAdded`.
- Žiadne „magické čísla" – balans patrí do `public/data/*.json`.
- Žiadny text v kóde – iba kľúče prekladu: `t('TRAIT_SHY')`.
- **`src/core/` nesmie importovať Phaser ani DOM.** Scény a HTML rozhranie čítajú stav z `core` a volajú jeho akcie.
- Pozor na mená polí v Phaser scénach: nesmú prekryť metódy `Scene` (napr. `init`, `create`, `update`).
- `textures.getPixel` v Phaseri 4 volať so súradnicami v rámci snímky a s menom snímky (`getPixel(x, y, key, frame)`); vzorkovanie cez celý hárok vracia `null`.
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
- Web a Tauri: `localStorage` (kľúč `meow-ambulance:save:1`); Capacitor: plugin Preferences/Filesystem – za spoločným rozhraním `SaveStorage` (`src/core/SaveManager.ts`).
- Ukladá sa každých 15 s, po dôležitých udalostiach a pri skrytí/zatvorení stránky. Pri načítaní sa dopočíta offline čas (`GameState.applyOffline`).
- Adresa končiaca `#novahra` zmaže uloženú hru (na testovanie).
- Pole `version` (aktuálne 15); pri zmene formátu sa pridá migračná funkcia do `MIGRATIONS` v `SaveManager.ts` a test v `tests/progress.test.ts`. Staré savy nesmú prestať fungovať.
- „Nová hra" v menu (☰ → Obchod) zmaže save a znovu načíta stránku; počas toho sa hra už neukladá.

## Testy a CI
- Simulácia balansu (bot hrá 8 h, 3 semienka): `SIM=1 npx vitest run tests/balance.sim.test.ts --silent=false` – výsledky v GDD §12a. Testy berú ★ úrovní z dát (`levelRep(n)` v `tests/loadData.ts`), takže zmena balansu ich nerozbije.
- Vitest pre `src/core/`: generovanie mačky, starostlivosť, výpočet zhody, hlásenia a adoptéri v čase, offline, ukladanie.
- Pri testovaní v headless Chromiu s emuláciou mobilu môže byť plátno WebGL na snímke čierne, ak je nad ním vysoký rolovací HTML panel – je to obmedzenie softvérového vykresľovania, nie chyba hry. Overiť na skutočnom zariadení.
- GitHub Actions: `npm ci && npm run lint && npm test && npm run build` pri každom PR.
- Po merge do `main`: nasadenie na GitHub Pages (`.github/workflows/deploy.yml`) → https://dzizka.github.io/Meow-ambulance/

### Nasadenie – jednorazové nastavenie
1. **Pages:** Settings → Pages → *Build and deployment* → Source: **GitHub Actions**.
2. **Token k assetom:** GitHub → Settings (profil) → Developer settings → Personal access tokens → *Fine-grained tokens* → Generate new token
   - Repository access: *Only select repositories* → **Meow-ambulance-offline**
   - Permissions: *Contents* → **Read-only** (nič viac)
   - Expirácia podľa uváženia (po vypršaní treba token obnoviť)
3. Token uložiť do repozitára **Meow-ambulance**: Settings → Secrets and variables → Actions → *New repository secret* → názov **`ASSETS_TOKEN`**.
4. Actions → *Deploy na GitHub Pages* → *Run workflow* (alebo ľubovoľný merge do `main`). Ručné spustenie má voľbu *latest_assets* – vezme najnovší stav súkromného repozitára namiesto zafixovaného podmodulu.

Zverejnená hra obsahuje iba súbory, ktoré hra používa (bez `_source/` a `licenses/`). To je v súlade s licenciami – assety sú súčasťou hry, nešíria sa samostatne.
- Minihry a UI sa testujú ručne podľa checklistu v PR – **vždy aj na telefóne**.

## Miestnosti
- Svet má osem miestností vedľa seba, každá `WORLD_W × WORLD_H`: garáž (x 0), kaviareň (`CAFE_X`) a Komunitný útulok (`SHELTER_X`, `ShelterRoom.ts` – karanténa a ambulancia) klinika (`CLINIC_X`, `ClinicRoom.ts`) catio (`CATIO_X`, `CatioRoom.ts`) mačací hotel (`HOTEL_X`, `HotelRoom.ts`) 2. poschodie kliniky (`CLINIC2_X`, `Clinic2Room.ts`) a edukačné centrum (`EDUCATION_X`, `EducationRoom.ts`). `roomAt(x)` povie, v ktorej miestnosti je bod. Kamera má hranice iba aktuálnej miestnosti (`GarageScene.showRoom`, `roomX` v `layout.ts`).
- Kaviareň kreslí `src/scenes/CafeRoom.ts` (pozadie, nábytok, hostia, bubliny objednávok); stav a pravidlá sú v `GameState` (sekcia Mačacia kaviareň), balans v `balance.json → cafe`.
- Hostia sú postavičky G5 (`personAnims.ts`, hárky sa načítajú podľa `cafe.guest_sprites`). „Sedenie": stolička má väčšiu hĺbku ako hosť, takže mu zakryje nohy.
- Save v3 pridal `cafe` a `counters.served` (migrácia `MIGRATIONS[2]`). Save v6 pridal `shelter`, `counters.vaccinated` a voliteľné `cat.ward` / `cat.vaccinated`.
- Pacienti: `cat.ward` = garáž alebo karanténa (`freeIn`, `moveCat`, `totalCages`). Diagnózy, ktoré hráč nemá čím odhaliť, mačky nedostanú (`generateCat({ tools })`).
- Rozloženie (`computeLayout` v `layout.ts`): na výšku svet hore a panel pod ním; na šírku, ak to svet nezmenší o viac ako ~28 %, je panel **ukotvený vpravo** (`docked`) a stále ukazuje prehľad miestnosti (mačky s ikonkami potrieb, voľné miesta, personál, hlásenia, záujemcovia) alebo kartu mačky. Na užšej obrazovke na šírku sa panel vysúva iba s kartou mačky. Svet je na šírku zvislo v strede.
- Obchod má záložky (`ShopTab`: stavby, výbava, personál, dekorácie). Okno po kúpe zachová posun (`UI.renderModal` – `modalViewKey`).
- Jazyk: ⚙️ v menu prepína slovenčinu a angličtinu (`setLang`, uloží sa do `localStorage` `meow:lang`, hra sa znovu načíta). Bez voľby podľa prehliadača.
- Mačka, ktorá 3× za sebou narazí do prekážky, sa presunie na voľné miesto vo svojej oblasti (`CatSprite.unstick`); pri načítaní sa mačky rozmiestnia v rámci vlastnej oblasti.
- Karta mačky sa prekreslí iba pri zmene obsahu (`UI.setSheet`) – inak by obnovovanie každých 500 ms mohlo zjesť ťuknutie.

## Ekonomika (GDD §6.1)
- Úrovne podľa ★: `balance.json → levels` (`GameState.level`, `hasUnlock`, udalosť `levelUp`). ★ sa nemíňajú.
- Vybavenie: `public/data/equipment.json`, stupne v `GameState.equipment`, účinky cez `equipmentEffect(id)` (kŕmidlo, strom, lekárnička, hračky, pelechy).
- Dekorácie: `public/data/decor.json` (pevné miesta, `layer` wall/floor/prop), útulnosť `GameState.coziness(room)`.
- Zobrazenie vo svete: `src/scenes/Furnishings.ts` (kŕmidlo, mačací strom, klbko a myška sú nakreslené kódom).
- Save v5 pridal `equipment` a `decor`.
- Klinika: stav `GameState.clinic` (`open`, `rooms`: lab/xray/or; save v8, `MIGRATIONS[7]`), ceny a bonusy `balance.json → clinic`. Nástroje `bloodtest` a `xray` pribudnú do `GameState.tools` s miestnosťou; diagnózy v `conditions.json` majú `ages` a `clinic`, operácia (`minigame: surgery`) sa dá iba s operačnou sálou (`needsOperatingRoom`). Hlásenie `referral` (`requires: clinic`, `clinic_case`). Minihry `bloodtest`, `xray` (dostane `xray: fracture | swallowed | null`), `surgery` (`neuter: true` bez pinzety) a `splint` v `MinigameScene`. Prístroje sú ťuknuteľné (`HOTSPOTS` → `UI.openStation` – výber pacienta). Udalosť `clinicVisit` (vyšetrenie krvou/röntgenom, operácia, dlaha, kastrácia) presunie mačku k prístroju (`CatSprite.pin`), po operácii na pelech so zotavením a potom späť (`GarageScene.clinicVisit`, iba zobrazenie, neukladá sa). Ťuknutie do sveta kontroluje `downElement`/`upElement` – Phaser počúva pustenie aj nad HTML oknom. Nekúpené miestnosti zakrýva plachta (`ClinicRoom.makeTarp`), vybavenie nakreslené kódom je v `ClinicRoom.makeTextures`.
- Catio: `GameState.catio` (save v9, `MIGRATIONS[8]`), účinok v `tick` (pomalší pokles spokojnosti stálic). Kto je vonku, rieši iba scéna (`GarageScene.outside`, `wanderOutside` každých 12 s; v noci všetci dnu) – neukladá sa.
- 2. poschodie: `clinic.floors` (save v11, `MIGRATIONS[10]`), miestnosti `ct` a `pool` v `clinic.rooms` (`FLOOR2_ROOMS`, odomknutia `clinicRoomUnlock`). `treatmentRoom(id)` povie, či diagnóza potrebuje sálu alebo bazén; rehabilitácia `canRehab` / `rehab` (`cat.rehabbed`). Minihry `ct` a `swim`. Návštevy `clinicVisit` s miestnosťou `ct`/`pool` idú na `Clinic2Room`.
- Edukačné centrum: `GameState.education` (`trip`, save v12, `MIGRATIONS[11]`), `advanceEducation` / `giveLecture(stars)`, udalosti `tripArrived` / `tripLeft`. Kvíz = minihra `quiz`, otázky v i18n `QUIZ_n_Q`, `QUIZ_n_A1` je vždy správna (`QUIZ_COUNT` v `MinigameScene`).
- Udalosti: `public/data/events.json`, `GameState.events` (`offer`, `active`, `timer`, `done`; save v14, `MIGRATIONS[13]`), `acceptEvent` / `declineEvent`, `advanceEvents`, účinky cez `eventActive(id)` (hlásenia, záujemcovia, hostia, dočasné klietky). Diagnózy s `event` padnú iba počas udalosti; hlásenie `mill` má `requires: event`. Vizuál v `GarageScene.setEventFx` (sneh, girlandy).
- Vzácne mačky: `cat.special` (losuje sa na konci `generateCat`), album `special:<znak>`. Srdiečka a kozmetika: `public/data/cosmetics.json`, `GameState.hearts` / `cosmetics` (save v15, `MIGRATIONS[14]`), `buyCosmetic`, `setAccessory`, `setWall`. Ozdoba = obrázok `acc-<id>` (`ensureAccessoryTextures` v `pixelIcons.ts`) na krku podľa tabuľky `NECK` v `CatSprite`; farba stien = priesvitná vrstva v `GarageScene.applyWall`.
- Úspechy: `public/data/achievements.json` (`kind` = počítadlo alebo špeciálny druh), `GameState.achievementProgress` / `checkAchievements` (v `tick` aj pri výzvach), `achievements` v save v13 (`MIGRATIONS[12]`), udalosť `achievementUnlocked`. Texty `ACH_<ID>` a `ACHD_<KIND>` (pre cieľ 1 voliteľne `ACHD_<KIND>_1`).
- Hotel: `GameState.hotel` (`open`, `suites`, `guests` – mačky s `cat.hotel`, nie sú v `cats`; save v10, `MIGRATIONS[9]`). `getCat` hľadá aj hostí, takže starostlivosť funguje rovnako. Platba a ★ v `advanceHotel`, udalosti `hotelCheckIn` / `hotelCheckOut` (majiteľ príde k recepcii – `HotelRoom.ownerVisit`). Balans `balance.json → hotel`.
- Vývojárske menu má sekciu Minihry – každá minihra na skúšku (na vybranej, prvej alebo vymyslenej mačke), výsledok sa nezapíše.
- Personál: `public/data/staff.json` (rola, cena, sprite, miestnosť), balans `balance.json → staff`. Stav `GameState.staff` (save v7, `MIGRATIONS[6]`), práca v `advanceStaff` (volá `tick`), udalosti `staffHired` a `staffAction`. Zobrazenie `src/scenes/StaffSprites.ts` (baristku zastupuje statická baristka v kaviarni).

## Správanie mačiek
- `CatSprite` dostáva `CatWorld` (`GarageScene.catWorld`): pôdorysy nábytku (`obstacles`), miesta za vysokým nábytkom (`hideZones` – tam nezastaví), ostatné mačky (rozostup ~18 × 10 px, aby nesedeli na sebe) a miesta pri hosťoch v kaviarni (`CafeRoom.guestSpotFor`).
- Geometriu plnia `addProp` / `addObstacle` zo `src/scenes/world.ts` (garáž, kaviareň, vybavenie, dekorácie).
- Stálica v kaviarni občas (30 % rozhodnutí, ak má dôveru ≥ 15) príde k sediacemu hosťovi – sadne si pred stôl a pozerá hore, alebo si ľahne vedľa; 8–15 s, srdiečka. K jednému hosťovi najviac jedna mačka.

## Vývojárske menu (tajné, na testovanie)
- **Otvorenie:** 5× rýchlo ťuknúť na hodiny v hornom paneli · na PC kláves `` ` `` (na slovenskej klávesnici `;`) · adresa končiaca `#dev`.
- Peniaze/★, okamžité hlásenie/záujemca/hosť, vyliečenie mačky, rýchlosť času 1×/5×/20×, posun hodín a dennej doby, simulácia offline (1 h / 8 h), splnenie výziev, pohľadnice hneď, kaviareň zadarmo, tutoriál odznova, uloženie, nová hra.
- Kód: `src/ui/DevMenu.ts` (rozhranie) a metódy `dev*` v `GameState` (logika, test v `tests/cafe.test.ts`). Texty menu sú výnimočne priamo v kóde a iba po slovensky – hráč ho nevidí.
- Je aj vo verejnej verzii (kto nevie o gestách, nenájde ho). Pred vydaním na obchody ho skryť za `import.meta.env.DEV`.

## Zvuky
- Základné zvuky sú v `AUDIO` (`src/assets.ts`) – vždy OGG + MP3.
- Voliteľné zvuky (`src/sfx.ts`) sa hľadajú v `public/assets/audio/sfx/extra/` pri štarte Vite / builde (`define __EXTRA_SFX__` vo `vite.config.ts`) – načítajú sa iba existujúce, takže žiadne chyby 404. Po pridaní súboru treba reštartovať `npm run dev`.
- Prehrávanie: `GameBridge.playSound(key, volume, fallback?)`; v minihrách `this.sfx(key, volume)`. Chýbajúci zvuk sa ticho preskočí.
- Zoznam a postup doplnenia pre autora: `docs/ASSETS.md` §7.

## Podmodul s assetmi
- Klonovanie: `git clone --recurse-submodules …`, aktualizácia: `git submodule update --remote public/assets`.
- Nové assety sa commitujú **najprv** v podmodule (`public/assets/`), potom sa vo verejnom repozitári commitne posun podmodulu.
- Build (`vite`) nesmie kopírovať `public/assets/_source/` a `public/assets/licenses/` – vyfiltruje sa v `vite.config.ts`.
