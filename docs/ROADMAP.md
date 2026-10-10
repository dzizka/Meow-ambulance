# Roadmapa

Každý míľnik = GitHub Milestone. Každá odrážka = GitHub Issue. Značky rozsahu podľa [GDD](GDD.md): 🟢 MVP · 🟡 v1.0 · 🔵 Neskôr.

---

## M0 – Základy projektu (1 týždeň)
- [ ] Vytvoriť GitHub repo, nastaviť Git LFS, ochranu vetvy `main`
- [ ] Založiť Godot 4 projekt v `game/`, nastaviť rozlíšenie (pixel-art: 640×360, škálovanie `viewport`, integer scaling)
- [ ] Autoloady: `GameState`, `TimeManager`, `EventBus`, `SaveManager`, `AudioManager` (prázdne kostry)
- [ ] GitHub Project (Kanban: Backlog → Todo → In progress → Review → Done)
- [ ] GitHub Actions: export Windows/Linux/Web pri tagu `v*`
- [ ] **Rozhodnutie o assetoch:** vybrať hlavný balík interiéru + mačiek + paletu (zapísať do `ASSETS.md`)

## M1 – Prototyp „šedé krabice" (2 týždne)
Cieľ: overiť zábavnosť slučky s placeholder grafikou.
- [ ] Generovanie mačky z `data/*.json` (`CatData`)
- [ ] Klietky v garáži, klik na mačku → karta mačky
- [ ] Štatistiky (Zdravie, Čistota, Dôvera, Spokojnosť) a ich pokles v čase
- [ ] Herný deň (07:00–20:00), pauza, zrýchlenie, súhrn dňa
- [ ] 1 liečebná minihra (kliešte) + 1 socializačná (pero)
- [ ] 1 adoptér, výpočet zhody, adopcia
- [ ] **Playtest #1** – je slučka zábavná aj bez grafiky?

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
- [ ] **Playtest #2** (5–10 externých hráčov), metriky z GDD §13
- [ ] Zverejniť demo na itch.io

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
- [ ] Mobilný port (🔵)
