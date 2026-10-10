# Free assety a hudba – výber, pravidlá a evidencia

## 1. Zlaté pravidlá
1. **Žiadny asset nejde do repozitára bez zápisu do tabuľky v časti 6** (a do `CREDITS.md`, ak licencia vyžaduje uvedenie autora).
2. Pri sťahovaní **ulož licenciu**: snímku obrazovky stránky s licenciou (alebo `README/license.txt` z balíka) do `licenses/<nazov-balika>.png|txt`. Licencie sa môžu meniť – dôležitá je tá, pod ktorou si asset stiahol.
3. Iba licencie, ktoré **povoľujú komerčné použitie** – hra sa raz môže predávať.
4. Pri pochybnostiach autorovi napíš (komentár na itch.io) a odpoveď ulož do `licenses/`.

## 2. ⚠️ Verejný repozitár a zákaz šírenia
Väčšina balíkov z itch.io má podmienku **„nesmie sa šíriť ani predávať samostatne"**. Hra, ktorá ich obsahuje, je v poriadku – ale **verejný GitHub repozitár so surovými PNG/WAV súbormi je šírenie**.

| Typ licencie | Môže byť vo verejnom repozitári? |
|---|---|
| CC0, CC BY, OFL | ✅ áno |
| „Free for commercial use, no redistribution" (väčšina itch.io) | ❌ nie – iba v **súkromnom** repozitári |

**Riešenie (vybrať jedno a zapísať sem):**
- **A) Súkromný repozitár** (odporúčané – najjednoduchšie). Testovacie buildy sa zverejňujú cez itch.io (stránka môže byť skrytá) alebo ako súkromný odkaz.
- **B) Verejný kód + súkromné assety:** balíky s obmedzením sú v samostatnom súkromnom repozitári pripojenom ako submodul `public/assets/licensed/`.

> Rozhodnutie: *(doplniť)*

## 3. Povolené a zakázané licencie
| Licencia | Komerčné použitie | Uvedenie autora | Poznámka |
|---|---|---|---|
| **CC0 / Public Domain** | ✅ | nepovinné (ale slušné) | **Preferovaná** |
| **CC BY 3.0 / 4.0** | ✅ | ✅ povinné | Zapísať presne podľa požiadavky autora |
| **OFL** (fonty) | ✅ | font sa nesmie predávať samostatne | Štandard pre Google Fonts |
| Vlastná licencia autora (itch.io) | podľa textu | podľa textu | Vždy overiť a uložiť |
| ❌ **CC BY-NC**, „personal use only", „non-commercial" | – | – | Blokuje predaj hry |
| ❌ **CC BY-ND** | – | – | Nesmieme upravovať (prefarbiť na paletu) |
| ⚠️ CC BY-SA / GPL | – | – | Iba po dohode – „nakazí" odvodené assety |
| ❌ Ripy z iných hier, AI výstupy neznámeho pôvodu | – | – | Právne riziko |

## 4. Vybrané balíky – zoznam na stiahnutie
Overené k 10. 10. 2026. **Mriežka hry: 32×32 px.** Pri „Name your own price" stačí zadať 0 $ (príspevok autorovi je dobrovoľný).

### 4.1 Grafika
| # | Na čo | Balík | Autor | Licencia (podľa stránky) | Credit | Cena |
|---|---|---|---|---|---|---|
| G1 | **Mačky – hlavné** (50 farieb, vzory, chôdza, beh, ležanie, sedenie) | [Cats – Pixel Asset Pack](https://pop-shop-packs.itch.io/cats-pixel-asset-pack) | Pop Shop Packs | komerčné ✅, úpravy ✅, nešíriť, nie AI/NFT | dobrovoľný | 0 $ |
| G2 | **Mačky – doplnkové animácie** (umývanie, spánok, labka, skok, strach) 32×32 | [2D Pixel Art Cat Sprites](https://elthen.itch.io/2d-pixel-art-cat-sprites) | Elthen | komerčné ✅ (detaily v jeho Patreon licencii – uložiť) | dobrovoľný | 0 $ |
| G3 | **Interiér garáže / domčeka** – steny, podlahy, okná, stoly, gauče, kuchynka, kúpeľňa | [House Interior Tileset 32x32](https://graduation-cat.itch.io/house-interior-tileset-32x32) – súbor **InteriorTilesLITE.png** | graduation-cat | komerčné ✅, úpravy ✅, nešíriť | dobrovoľný | 0 $ (LITE) |
| G4 | **Ambulancia / klinika** – vyšetrovacie stoly, monitory, infúzie, vozíky, skrinky | [Pixel Hospital Tileset 32x32](https://jackburton84.itch.io/pixel-hospital-tileset-modern-medical-pixel-art-32x32) | jackburton84 | komerčné ✅, nešíriť | nepovinný | 0 $ |
| G5 | **Ľudia** – adoptéri, dobrovoľníci (40 postáv, chôdza 4 smery, 20×32) | [Top-Down Pixel Art Characters](https://gamebetweenthelines.itch.io/top-down-pixel-art-characters) | Game Between The Lines | komerčné ✅ (potvrdené autorom) | dobrovoľný | 0 $ |
| G6 | **UI** – panely, tlačidlá, kurzory, progress bary (pixel) | [Pixel UI Pack (750 assets)](https://opengameart.org/content/pixel-ui-pack-750-assets) | Kenney | **CC0** | nepovinný | 0 $ |
| G7 | **Ikony a častice** (srdiečka, hviezdičky, ✨) | [Kenney – všetky 2D balíky](https://kenney.nl/assets) (napr. *Particle Pack*, *Game Icons*) | Kenney | **CC0** | nepovinný | 0 $ |
| G8 | **Paleta** | [Lospec Palette List](https://lospec.com/palette-list) – vyberieme pri M1 podľa G1+G3 | – | voľne | – | 0 $ |

**Voliteľné lacné vylepšenia** (iba ak by free výber nestačil – nie sú potrebné na štart):
- [Modern Interiors](https://limezu.itch.io/moderninteriors) (LimeZu) – obrovský interiérový balík v 32×32 aj s generátorom postáv; komerčná licencia od 1,50 $, credit povinný. Licencia free verzie nie je na stránke jasná → nepoužívať bez zaplatenia.
- [Customizable Characters 32x32](https://schwarnhild.itch.io/customizable-characters-top-down-32x32) (Schwarnhild) – skladacie postavy, modulárne súbory od 1,30 $.
- [Simple Hospital Tileset](https://darkizu.itch.io/simple-hospital-tileset) (Darkizu) – 32×32, od 1,99 $.

**Vylúčené po kontrole:** Sprout Lands Basic (iba nekomerčné), Retro Cats free verzia (iba osobné použitie).

### 4.2 Font
| # | Font | Licencia | Poznámka |
|---|---|---|---|
| F1 | [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) | **OFL** | Obsahuje latin-ext → slovenská diakritika ✅. Nadpisy a UI. |
| F2 | *(voliteľné)* čitateľný text pre dlhšie príbehy – vyberieme pri M2 (Google Fonts, latin-ext) | OFL | |

### 4.3 Hudba
| # | Na čo | Balík | Autor | Licencia | Credit |
|---|---|---|---|---|---|
| M1 | **Hlavná hudba dňa** – lo-fi, útulná (7 skladieb, OGG/MP3/WAV) | [Analog Café – Lofi Background Music (Free)](https://kento-games.itch.io/lo-fi-background-music) | Kento Games | „Royalty free", komerčné potvrdené autorom v komentároch → **uložiť snímku komentára** | dobrovoľný |
| M2 | **Pokojná hudba** – menu, album, večer (6 skladieb) | [JRPG Pack 4 – Calm](https://opengameart.org/content/jrpg-pack-4-calm) | Juhani Junkala (SubspaceAudio) | **CC0** | nepovinný |
| M3 | **Rezerva / udalosti** – jemná, s napätím v neskorších skladbách (10 skladieb) | [Indie Meditations – Free Music Pack](https://opengameart.org/content/indie-meditations-free-music-pack) | YannZ | **CC BY 4.0** | ✅ povinný |

### 4.4 Zvukové efekty
| # | Na čo | Balík | Autor | Licencia |
|---|---|---|---|---|
| S1 | **Pradenie (2 slučky) a mňaukanie (4)** | [Cat Purr & Meow](https://opengameart.org/content/cat-purr-meow) | Kerzoven | **CC0** |
| S2 | **Pradenie – kvalitnejšia nahrávka** | [Cat purr (S0436)](https://bigsoundbank.com/cat-purr-s0436.html) | BigSoundBank | **CC0** |
| S3 | **UI zvuky** – kliky, potvrdenia (100 zvukov) | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | Kenney | **CC0** |
| S4 | Ďalšie mačacie zvuky (syčanie, mrnčanie) – dohľadať pri M2 | [Freesound.org](https://freesound.org) – filter *Creative Commons 0* | rôzni | CC0 |

## 5. Štýlová konzistencia
- Mačky (G1, G2), interiér (G3), klinika (G4) a ľudia (G5) sú v mierke 32 px – po stiahnutí to overíme a prípadne doladíme mierku.
- Všetko sa prefarbí na jednu paletu (G8) – nástroj [Pixelorama](https://orama-interactive.itch.io/pixelorama) (free) alebo Aseprite.
- Chýbajúce mačacie farby vytvoríme **prefarbením existujúcich spritov**, nie hľadaním ďalších balíkov.
- Pohľadnice a ilustrácie minihier môžu mať vyššie rozlíšenie, ale rovnakú paletu.

## 6. Evidencia assetov v repozitári
> Každý riadok = jeden balík. Vypĺňa ten, kto asset pridáva.

| Priečinok v `public/assets/` | Balík (#) | Licencia | Smie byť verejne? | Credit povinný | Upravené? | Licencia uložená | Pridal / dátum |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
