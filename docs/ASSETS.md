# Free assety a hudba – pravidlá a zdroje

## 1. Zlaté pravidlá
1. **Žiadny asset nejde do repozitára bez zápisu do tabuľky nižšie** (a do `CREDITS.md`, ak licencia vyžaduje uvedenie autora).
2. Pred stiahnutím **prečítaj licenciu** na stránke autora a urob si snímku obrazovky / ulož text licencie do `game/assets/_licenses/`. Licencie sa môžu meniť – dôležitá je tá, pod ktorou si asset stiahol.
3. Hra môže byť raz predávaná, preto používame iba licencie, ktoré **povoľujú komerčné použitie**.
4. Pri pochybnostiach autorovi napíš a odpoveď ulož do `_licenses/`.

## 2. Povolené licencie
| Licencia | Komerčné použitie | Uvedenie autora | Poznámka |
|---|---|---|---|
| **CC0 / Public Domain** | ✅ | nepovinné (ale slušné) | **Preferovaná** |
| **CC BY 3.0 / 4.0** | ✅ | ✅ povinné | Zapísať presne podľa požiadavky autora |
| **OFL** (fonty) | ✅ | font sa nesmie predávať samostatne | Štandard pre Google Fonts |
| Vlastná licencia autora (itch.io) | podľa textu | podľa textu | Často „free for commercial use, credit appreciated" – vždy overiť |
| Pixabay Content License | ✅ | nepovinné | Nesmie sa redistribuovať samostatne – v hre OK |

## 3. Zakázané / rizikové
| Licencia | Prečo |
|---|---|
| **CC BY-NC** (NonCommercial) | Blokuje predaj hry |
| **CC BY-ND** (NoDerivatives) | Nesmieme upravovať (prefarbiť na paletu) |
| **CC BY-SA / GPL** pre assety | Možné, ale „nakazí" odvodené assety rovnakou licenciou – iba po dohode v tíme |
| „Free for personal use" | Nie je free pre nás |
| AI-generované assety neznámeho pôvodu, ripy z iných hier | Právne riziko |

## 4. Kde hľadať
### Grafika
| Zdroj | Typická licencia | Na čo |
|---|---|---|
| [Kenney.nl](https://kenney.nl/assets) | CC0 | UI prvky, ikonky, častice, placeholder grafika |
| [itch.io – free game assets](https://itch.io/game-assets/free) (filtrovať: *pixel art, top-down, cats, interior*) | podľa autora | Hlavný zdroj interiérov, nábytku a mačiek |
| [OpenGameArt.org](https://opengameart.org) | CC0 / CC BY / GPL | Doplnky – filtrovať podľa licencie |
| [Lospec](https://lospec.com/palette-list) | palety voľne | Jednotná paleta pre celú hru |
| [Game-icons.net](https://game-icons.net) | CC BY 3.0 | Ikony pre UI |

### Hudba
| Zdroj | Licencia | Poznámka |
|---|---|---|
| [Incompetech (Kevin MacLeod)](https://incompetech.com) | CC BY 4.0 | Veľa pokojných skladieb, povinný credit |
| [FreePD](https://freepd.com) | CC0 | Bez povinného creditu |
| [OpenGameArt – Music](https://opengameart.org/art-search-advanced?field_art_type_tid%5B%5D=12) | rôzne | Filtrovať CC0/CC BY |
| [Pixabay Music](https://pixabay.com/music/) | Pixabay License | Lo-fi, akustika |
| itch.io – *free music, lofi, cozy* | podľa autora | Celé „cozy" balíky |

### Zvukové efekty
| Zdroj | Licencia | Poznámka |
|---|---|---|
| [Freesound.org](https://freesound.org) | CC0 / CC BY (pozor na NC!) | Pradenie, mňaukanie – filtrovať licenciu |
| [Kenney – Audio](https://kenney.nl/assets?q=audio) | CC0 | UI zvuky, kliky |
| [Pixabay Sound Effects](https://pixabay.com/sound-effects/) | Pixabay License | Zvieracie zvuky |

### Fonty
| Zdroj | Licencia |
|---|---|
| [Google Fonts](https://fonts.google.com) | OFL – overiť podporu slovenských znakov (č, ď, ľ, ň, ô, ŕ, ť, ž, ĺ) |

## 5. Štýlová konzistencia
- Vybrať **1 hlavný balík** pre interiér a **1 pre mačky** v rovnakej veľkosti mriežky (16 px alebo 32 px).
- Všetko prefarbiť na paletu z Lospec (Aseprite / LibreSprite / Pixelorama – posledný je free).
- Chýbajúce mačacie farby (vzory) vytvoriť **prefarbením základného sprite** – nie hľadaním ďalších balíkov.
- Pohľadnice a ilustrácie minihier môžu mať vyššie rozlíšenie, ale rovnakú paletu.

## 6. Evidencia assetov
> Každý riadok = jeden balík alebo samostatný súbor. Vypĺňa ten, kto asset pridáva.

| Súbor / priečinok | Názov a autor | Zdroj (URL) | Licencia | Credit povinný | Upravené? | Pridal / dátum |
|---|---|---|---|---|---|---|
| *(príklad)* `assets/ui/kenney_ui/` | UI Pack – Kenney | https://kenney.nl/assets/ui-pack | CC0 | nie | nie | — |
