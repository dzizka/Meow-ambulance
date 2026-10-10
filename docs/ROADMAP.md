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
- [ ] Nasadenie webovej verzie s assetmi (potrebuje token k súkromnému repozitáru) – zatiaľ ručne ako Claude artifact
- [ ] GitHub Project (Kanban: Backlog → Todo → In progress → Review → Done)

## M1 – Prototyp „šedé krabice" (2 týždne)
Cieľ: overiť zábavnosť slučky s jednoduchou grafikou – **hrateľné na mobile cez odkaz**.
- [x] Načítanie `public/data/*.json`, generovanie mačky (`CatGenerator`) + testy
- [x] Garáž (zatiaľ poskladaná v kóde), klietky, ťuk na mačku → karta mačky; mačky sa prechádzajú v 8 smeroch
- [ ] Garáž z Tiled mapy
- [x] Karta mačky so štatistikami (Zdravie, Čistota, Dôvera, Spokojnosť)
- [ ] Pokles štatistík v čase
- [x] Herný deň (07:00–20:00), pauza, zrýchlenie
- [ ] Súhrn dňa
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
