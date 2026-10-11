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
- [x] Mačky obchádzajú nábytok (pôdorysy nábytku ako prekážky)
- [ ] Garáž z Tiled mapy (presunuté – teraz nie je nutné)
- [ ] **Playtest #1** na PC aj telefóne – je slučka zábavná?

## M2 – Vertikálny rez / MVP (6–8 týždňov)
- [x] Grafika garáže a mačiek z vybraných free assetov
- [x] Efekt premeny (iskričky, pradenie), špinavá mačka tmavšia
- [x] Stav mačky v garáži: značka nad hlavou (? nevyšetrená, ✚ liečiť, ♥ pripravená), lesk čistej srsti, „z" pri spánku
- [ ] Obväz na labke po ošetrení (potrebuje sprite alebo prekreslenie)
- [x] Diagnostika so skrytými diagnózami (ruka, teplomer, stetoskop)
- [x] 5 liečebných minihier: kliešte, obväz (krúženie), uši (stieranie), sirup (načasovanie), inhalácia (dýchanie v rytme)
- [x] 3 socializačné: pero, česanie, kŕmenie z ruky
- [x] 6 rysov, odhaľovanie rysov
- [x] 8 archetypov adoptérov
- [x] Album (36 slotov) – adoptované aj stálice, pohľadnice v albume
- [x] Nástenka výziev (3 aktívne úlohy, 10 typov, rastúce ciele)
- [x] Ekonomika: €, ★, nákup 3. a 4. klietky a rozšírenie kútika (menu ☰ → Obchod)
- [x] Tutoriál so Zuzkou (rady podľa postupu hráča, dá sa skryť)
- [x] Ukladanie v2 s migráciou starých savov, „Nová hra" v menu
- [ ] Ukladanie (3 sloty, autosave)
- [x] Ekonomika: úrovne útulku podľa ★, obchod s vybavením (5 kusov × 3 stupne) a dekoráciami (15, útulnosť) – GDD §6.1
- [x] Fáza 2 – Komunitný útulok: karanténa (+4 klietky), ambulancia (otoskop, ušné roztoče, očkovanie), mačacia rodinka
- [x] Hudba: 6 skladieb – lo-fi cez deň, pokojné večer a v noci, načítanie na pozadí
- [x] UI zvuky (Kenney) v rozhraní aj minihrách
- [x] Hra pripravená na voliteľné zvuky – **dopĺňa autor** (ASSETS.md §7)
- [x] SK + EN lokalizácia (rovnaké kľúče, kontroluje test)
- [ ] Rozloženie UI na výšku aj na šírku, test na lacnom Android telefóne
- [ ] **Playtest #2** (5–10 externých hráčov), metriky z GDD §13
- [ ] Zverejniť webové demo na itch.io
- [ ] Prvý Android build cez Capacitor (interné testovanie) a PC build cez Tauri

## M3 – Komunitný útulok (Fáza 2)
- [ ] Systém stavby miestností na mriežke
- [x] **Mačacia kaviareň** pre stálice – druhá miestnosť, hostia s objednávkami, obsluha ťuknutím, dary, dokupovanie stolov (GDD §5.5; presunuté do Fázy 1)
- [x] Karanténa, ambulancia (Komunitný útulok)
- [x] Nové minihry: kúpanie (blchy), strihanie pazúrikov (dlhé pazúriky)
- [x] Minihra očkovanie, minihra kvapky do uška
- [x] Prvé udalosti: Zima prichádza, Deň otvorených dverí (GDD §7.3)
- [x] Rozšírenie na 15 rysov, 12 plemien, 13 farieb (album 84 políčok)

## M4 – Klinika (Fáza 3)
- [x] Personál a automatizácia – ošetrovateľ, veterinárka, baristka, správca sietí (úroveň 5, GDD §6.4)
- [x] Klinika: laboratórium, röntgen, operačná sála, 4 nové minihry, kastrácia, prípady z iných útulní (GDD §6.5)
- [x] Catio – vonkajší výbeh pre stálice (GDD §6.6)
- [x] Udalosť Záchrana z množiarne (GDD §7.3)
- [x] Vzácne mačky, Srdiečka a kozmetika (GDD §7.2, §7.6)

## M5 – Národné centrum (Fáza 4) a vydanie v1.0
- [x] Mačací hotel (GDD §6.7)
- [x] Viac poschodí, CT, rehabilitačný bazén – 2. poschodie kliniky (GDD §6.8)
- [x] Edukačné centrum – školské výlety a kvíz (GDD §6.9)
- [x] Balans celej hry – simulácia hráča, úpravy ★ a cien (GDD §12a)
- [x] Achievementy – 24 úspechov s odmenami (GDD §7.5)
- [ ] Steam stránka / itch.io vydanie
- [ ] Vydanie na Google Play a App Store
