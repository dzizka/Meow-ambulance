# Roadmapa

Každý míľnik = GitHub Milestone. Každá odrážka = GitHub Issue. Značky rozsahu podľa [GDD](GDD.md): 🟢 MVP · 🟡 v1.0 · 🔵 Neskôr.

---

## M0 – Základy projektu (1 týždeň)
- [x] GitHub repozitár, GDD, pravidlá assetov
- [x] Súkromný repozitár pre assety, pripojený ako podmodul `public/assets/`
- [ ] Ochrana vetvy `main`
- [x] Stiahnuť a nahrať vybrané assety (ASSETS.md §4), uložiť licencie do `public/assets/licenses/`
- [x] Kostra projektu: Vite + TypeScript + Phaser, ESLint, Prettier, Vitest
- [x] Konfigurácia Phaseru pre pixel-art (svet 480×270, na výšku aj na šírku, posúvanie prstom)
- [x] `src/core/`: GameState, TimeManager, EventBus, Rng, CatGenerator + testy (SaveManager v M1)
- [x] GitHub Actions: lint + testy + build pri PR
- [x] Workflow na nasadenie na GitHub Pages (`deploy.yml`)
- [ ] Zapnúť Pages a pridať secret `ASSETS_TOKEN` (TECH.md – Nasadenie)
- [ ] GitHub Project (Kanban: Backlog → Todo → In progress → Review → Done)

## M1 – Hrateľná základná slučka (2–3 týždne)
Cieľ: celá slučka záchrana → liečba → adopcia alebo stálica, v otvorenom režime – **hrateľné na mobile cez odkaz**.
- [x] Načítanie `public/data/*.json`, generovanie mačky (`CatGenerator`) + testy
- [x] Garáž (zatiaľ poskladaná v kóde), klietky, ťuk na mačku → karta mačky; mačky sa prechádzajú v 8 smeroch
- [x] Karta mačky so štatistikami
- [x] **Otvorený režim:** hodiny iba pre atmosféru (deň/noc), bez konca dňa (GDD §2.2)
- [x] Hlásenia o mačkách v reálnom čase (max 3, nevypršia), prijatie do voľnej klietky
- [x] Pokles čistoty a spokojnosti, zotavovanie zdravia (iba keď hra beží)
- [x] Prehliadka (ruka, teplomer) odhaľuje diagnózy
- [x] Minihra **vyťahovanie kliešťov** + univerzálna minihra „podrž" pre ostatné ošetrenia
- [x] Socializácia: **hra s perom** (minihra), česanie, kŕmenie z ruky, tiché sedenie; odhaľovanie rysov
- [x] Adoptéri v reálnom čase, výpočet zhody (`Match`) + testy, adopcia s príspevkom
- [x] **Stálice:** nechať si mačku, kútik pre 2, dary od návštevníkov
- [x] Pohľadnica po adopcii
- [x] Ukladanie (localStorage) + offline príjem a privítanie po návrate (GDD §2.3)
- [x] HTML rozhranie nad plátnom
- [ ] Garáž z Tiled mapy, mačky obchádzajú nábytok (presunuté do M2)
- [ ] **Playtest #1** na PC aj telefóne – je slučka zábavná?

## M2 – Vertikálny rez / MVP (6–8 týždňov)
- [ ] Grafika garáže a mačiek z vybraných free assetov
- [x] Efekt premeny (iskričky, pradenie), špinavá mačka tmavšia
- [ ] 3 plné vizuálne stavy mačky (obväzy, lesk)
- [ ] Diagnostika so skrytými diagnózami (ruka, teplomer, stetoskop)
- [ ] 4 liečebné minihry: kliešte, obväz, uši, sirup
- [ ] 3 socializačné: pero, česanie, kŕmenie z ruky
- [ ] 6 rysov, odhaľovanie rysov
- [ ] 8 archetypov adoptérov
- [x] Album (36 slotov) – adoptované aj stálice, pohľadnice v albume
- [x] Nástenka výziev (3 aktívne úlohy, 10 typov, rastúce ciele)
- [x] Ekonomika: €, ★, nákup 3. a 4. klietky a rozšírenie kútika (menu ☰ → Garáž)
- [x] Tutoriál so Zuzkou (rady podľa postupu hráča, dá sa skryť)
- [x] Ukladanie v2 s migráciou starých savov, „Nová hra" v menu
- [ ] Ukladanie (3 sloty, autosave)
- [ ] Hudba (3 skladby) + SFX (~20)
- [ ] SK + EN lokalizácia
- [ ] Rozloženie UI na výšku aj na šírku, test na lacnom Android telefóne
- [ ] **Playtest #2** (5–10 externých hráčov), metriky z GDD §13
- [ ] Zverejniť webové demo na itch.io
- [ ] Prvý Android build cez Capacitor (interné testovanie) a PC build cez Tauri

## M3 – Komunitný útulok (Fáza 2)
- [ ] Systém stavby miestností na mriežke
- [ ] Karanténa, **mačacia kaviareň** pre stálice (návštevníci, väčšie dary), ambulancia
- [ ] Nové minihry: kúpanie, očkovanie, pazúriky
- [ ] Prvé udalosti: Zima prichádza, Deň otvorených dverí
- [ ] Rozšírenie na 15 rysov, 12 plemien

## M4 – Klinika (Fáza 3)
- [ ] Personál a automatizácia
- [ ] Laboratórium, röntgen, operačná sála, catio
- [ ] Udalosť Záchrana z množiarne
- [ ] Vzácne mačky, Srdiečka a kozmetika

## M5 – Národné centrum (Fáza 4) a vydanie v1.0
- [ ] Viac poschodí, CT, bazén, hotel, edukačné centrum
- [ ] Balans celej hry, achievementy
- [ ] Steam stránka / itch.io vydanie
- [ ] Vydanie na Google Play a App Store
