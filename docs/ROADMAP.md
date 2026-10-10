# Roadmapa

Každý míľnik = GitHub Milestone. Každá odrážka = GitHub Issue. Značky rozsahu podľa [GDD](GDD.md): 🟢 MVP · 🟡 v1.0 · 🔵 Neskôr.

---

## M0 – Základy projektu (1 týždeň)
- [x] GitHub repozitár, GDD, pravidlá assetov
- [ ] Rozhodnúť verejný/súkromný repozitár kvôli licenciám assetov (ASSETS.md §2), nastaviť Git LFS a ochranu vetvy `main`
- [ ] Stiahnuť a nahrať vybrané assety (ASSETS.md §4), uložiť licencie do `licenses/`
- [ ] Kostra projektu: Vite + TypeScript + Phaser, ESLint, Prettier, Vitest
- [ ] Konfigurácia Phaseru pre pixel-art (480×270, celočíselné škálovanie, na výšku aj na šírku)
- [ ] `src/core/`: prázdne kostry GameState, TimeManager, EventBus, SaveManager, CatRegistry
- [ ] GitHub Actions: lint + testy + build pri PR, nasadenie webovej verzie
- [ ] GitHub Project (Kanban: Backlog → Todo → In progress → Review → Done)

## M1 – Prototyp „šedé krabice" (2 týždne)
Cieľ: overiť zábavnosť slučky s jednoduchou grafikou – **hrateľné na mobile cez odkaz**.
- [ ] Načítanie `public/data/*.json`, generovanie mačky (`CatGenerator`) + testy
- [ ] Garáž z Tiled mapy, klietky, klik/ťuk na mačku → karta mačky
- [ ] Štatistiky (Zdravie, Čistota, Dôvera, Spokojnosť) a ich pokles v čase
- [ ] Herný deň (07:00–20:00), pauza, zrýchlenie, súhrn dňa
- [ ] 1 liečebná minihra (kliešte) + 1 socializačná (pero)
- [ ] 1 adoptér, výpočet zhody (`MatchCalculator`) + testy, adopcia
- [ ] Výber palety, test mierky assetov
- [ ] **Playtest #1** na PC aj telefóne – je slučka zábavná?

## M2 – Vertikálny rez / MVP (6–8 týždňov)
- [ ] Grafika garáže a mačiek z vybraných free assetov
- [ ] 3 vizuálne stavy mačky + efekt premeny
- [ ] Diagnostika so skrytými diagnózami (ruka, teplomer, stetoskop)
- [ ] 4 liečebné minihry: kliešte, obväz, uši, sirup
- [ ] 3 socializačné: pero, česanie, kŕmenie z ruky
- [ ] 6 rysov, odhaľovanie rysov
- [ ] 8 archetypov adoptérov
- [ ] Pohľadnice + Album (36 slotov)
- [ ] Ekonomika: €, ⭐, náklady na krmivo
- [ ] Tutoriál so Zuzkou (prvé 3 dni skriptované)
- [ ] Ukladanie (3 sloty, autosave)
- [ ] Hudba (3 skladby) + SFX (~20)
- [ ] SK + EN lokalizácia
- [ ] Rozloženie UI na výšku aj na šírku, test na lacnom Android telefóne
- [ ] **Playtest #2** (5–10 externých hráčov), metriky z GDD §13
- [ ] Zverejniť webové demo na itch.io
- [ ] Prvý Android build cez Capacitor (interné testovanie) a PC build cez Tauri

## M3 – Komunitný útulok (Fáza 2)
- [ ] Systém stavby miestností na mriežke
- [ ] Karanténa, herňa pre verejnosť (návštevníci, dary), ambulancia
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
