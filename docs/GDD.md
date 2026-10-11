# Labková záchranka – Game Design Document (GDD)

> **Pracovný názov:** Labková záchranka (EN: *Paw Rescue*)
> **Žáner:** Cozy manažment / simulácia útulku a veterinárnej kliniky
> **Technológia:** TypeScript + Phaser (HTML5), Vite
> **Platformy:** Web (demo) · PC cez Tauri (Windows / macOS / Linux, Steam) · Mobil cez Capacitor (Android / iOS)
> **Verzia dokumentu:** 0.2 – otvorený režim bez konca dňa, stálice a mačacia kaviareň (živý dokument – každá zmena ide cez Pull Request)

---

## 0. Ako s týmto dokumentom pracovať

- Toto je **jediný zdroj pravdy** o dizajne hry. Ak sa niečo v kóde líši od GDD, buď sa opraví kód, alebo sa cez PR upraví GDD.
- Každá sekcia má značku rozsahu:
  - 🟢 **MVP** – musí byť vo vertikálnom reze (prvá hrateľná verzia)
  - 🟡 **v1.0** – potrebné pre plné vydanie
  - 🔵 **Neskôr** – nápady na aktualizácie po vydaní
- Čísla (ceny, časy, štatistiky) sú **štartovacie hodnoty na balansovanie**, nie definitívne. Všetky žijú v dátových súboroch (`public/data/`), nie v kóde.

---

## 1. Vízia

### 1.1 Jedna veta
*Zachráň vystrašenú mačku z ulice, vylieč ju, získaj jej dôveru a nájdi jej dokonalý domov – a z garáže postav národné centrum pre záchranu mačiek.*

### 1.2 Piliere hry (Design Pillars)
Každá nová funkcia musí podporovať aspoň jeden pilier. Ak nepodporuje žiadny, nepatrí do hry.

| Pilier | Čo znamená v praxi |
|---|---|
| **1. Každá mačka je osobnosť** | Meno, vzhľad, povaha, príbeh. Hráč si mačky pamätá, nie sú to čísla. |
| **2. Viditeľná premena** | Špinavá a vystrašená → lesklá a priadúca. Pokrok musí byť *vidieť*, nie len čítať. |
| **3. Malé uspokojivé dotyky** | Minihry sú krátke (5–20 s), hmatové a príjemné, nikdy frustrujúce. |
| **4. Rast bez stresu** | Žiadne smrti mačiek, žiadny game over, žiadny koniec dňa. Hráč robí, čo chce a kedy chce. Tlak existuje iba ako jemná motivácia (miesto, výzvy), nikdy ako trest. |
| **5. Emocionálna odmena** | Pohľadnice z nového domova, album príbehov, mačky, ktoré si hráč nechal – dôvod vrátiť sa zajtra. |

### 1.3 Cieľová skupina
- **Primárna:** milovníci mačiek a cozy hier, 16–40 rokov, hrajú Stardew Valley, Cats & Soup, Unpacking, Cat Cafe Manager.
- **Sekundárna:** fanúšikovia manažmentových hier (Two Point Hospital, Theme Hospital), ktorí chcú pokojnejší zážitok.
- **Dĺžka sedenia:** 15–45 minút (PC), 3–10 minút (mobil).

### 1.4 Inšpirácie a čo si z nich berieme
| Hra | Čo berieme |
|---|---|
| Two Point Hospital | Stavba miestností, diagnostika → liečba, najímanie personálu, humor |
| Stardew Valley | Vzťahy, pocit „ešte jedna vec", striedanie dňa a noci ako atmosféra |
| Cats & Soup | Otvorený režim bez konca dňa, príjem aj keď hráč nehrá, roztomilé animácie, zberateľstvo |
| Good Pizza, Great Pizza | Zákazníci s požiadavkami (→ adoptéri), čitateľné postavy |
| Pokémon (Pokédex) | Album na zbieranie plemien a variácií |

### 1.5 Čo hra NIE JE
- Nie je to realistický veterinárny simulátor (žiadna krv, žiadna eutanázia, žiadne smrti).
- Nie je to free-to-play s energiou a čakaním (aspoň nie v PC verzii).
- Nie je to hra o rýchlosti a reflexoch.

---

## 2. Herná slučka

### 2.1 Makro slučka
```
   Hlásenie o mačke → Záchrana → Liečba a socializácia
                                        │
                     ┌──────────────────┴──────────────────┐
                     ↓                                     ↓
           Adopcia do správnych rúk              Stálica (hráč si ju nechá)
      (príspevok, pohľadnica, album)       (dary z mačacej kaviarne, pomoc)
                     └──────────────────┬──────────────────┘
                                        ↓
                Peniaze + Reputácia → Rozšírenie útulku → viac miesta
```

### 2.2 Otvorený režim – bez konca dňa 🟢 MVP
Hra **nemá herné dni ani obrazovku konca dňa**. Hráč robí, čo chce a kedy chce – môže sa aj len pozerať na svoje mačky.

- **Hodiny sú iba atmosféra.** Čas plynie (cez deň 1 reálna minúta = 1 herná hodina, v noci 3× rýchlejšie – noc trvá ~2,7 min), mení sa svetlo – ráno, deň, večer s lampami, noc, keď mačky spia. Na nič netlačí.
- **Udalosti prichádzajú v reálnom čase:**
  - **Hlásenia o mačkách** – nové každé ~4 minúty, čaká ich najviac 3. **Nevypršia.** Hráč ich prijme, keď má voľnú klietku a chuť.
  - **Záujemcovia o adopciu** – prídu každé ~3 minúty, ak je aspoň jedna mačka pripravená na adopciu. Čakajú najviac 2 a **neodchádzajú**.
  - **Dary z mačacej kaviarne** – priebežne podľa počtu stálic (§5.4).
  - **Pohľadnice** – 2–5 minút po adopcii.
- **Výzvy** (§7.3) dávajú smer, ale nemajú časový limit.
- Rýchlosť času sa neprepína (nie je dôvod) – v M0 prepínanie bolo, v M1 zaniká.

### 2.3 Keď hráč hru zavrie (offline) 🟢 MVP
**Beží iba to dobré.**

| Čo | Offline |
|---|---|
| Hlásenia o mačkách | nazbierajú sa (do limitu 3) |
| Dary z kaviarne | nazbierajú sa, najviac za 8 hodín |
| Pohľadnice | doručia sa |
| Potreby mačiek (čistota, spokojnosť) | **neklesajú** |
| Adoptéri | neprichádzajú (prídu po návrate) |

Po návrate hráč uvidí krátke privítanie: „Kým si bol preč: 2 nové hlásenia, 34 € od návštevníkov kaviarne, 1 pohľadnica." Žiadne výčitky.

---

## 3. Fáza 1 – Záchrana a príjem (Rescue)

### 3.1 Hlásenia 🟢 MVP
Každé hlásenie je karta s:
- **Miesto a situácia** – „Mačiatko v krabici pred obchodom", „Zranená divá mačka na stavbe"
- **Odhad náročnosti** – 1 až 3 labky
- **Hlásenie nevyprší** (§2.2) – čaká, kým ho hráč prijme. Zamietnuté hlásenie vybaví iný útulok (bez trestu).

Po prijatí sa hrá krátka **záchranná scénka** (🟡 v1.0: minihra – nalákanie mačky do prepravky maškrtou; 🟢 MVP: iba animácia/ilustrácia).

### 3.2 Generovanie mačky 🟢 MVP
Každá mačka sa generuje procedurálne z dátových tabuliek:

| Atribút | Príklad | Zdroj |
|---|---|---|
| Meno | Mrkvička, Bublina, Pán Fúzik | `public/data/names.json` (zoznam + slovná hračka podľa farby) |
| Vek | mačiatko / dospelá / senior | váhovaná náhoda podľa typu hlásenia |
| Plemeno / typ | domáca krátkosrstá, perzská, mainská mývalia… | `public/data/breeds.json` |
| Farba a vzor | rufus, čierna, trojfarebná, mourovatá, tuxedo… | `public/data/coats.json` |
| Povaha (1–2 rysy) | plachá, maznavá, divoká, maškrtná… | `public/data/traits.json` |
| Diagnózy (1–3) | kliešte, zranená labka, infekcia uší… | `public/data/conditions.json` |
| Minipríbeh | 2–3 vety, skladané zo šablón | `public/data/stories.json` |

### 3.3 Štatistiky mačky 🟢 MVP
Všetky na škále **0–100**:

| Štatistika | Význam | Vizuálny prejav |
|---|---|---|
| **Zdravie** | Liečba diagnóz | Obväzy, kuľhanie, kýchanie |
| **Čistota** | Kúpanie, česanie | Špina, zlepená srsť → lesk |
| **Dôvera** | Socializácia | Schovávanie sa, syčanie → pradenie, otáčanie brucha |
| **Spokojnosť** | Jedlo, hračky, prostredie | Ovisnuté uši → hra, poskakovanie |

**Pripravená na adopciu** = všetky diagnózy vyliečené + Zdravie ≥ 80 + Dôvera ≥ 60.

**Zmeny v čase (iba keď hra beží, §2.3):**
- Čistota klesá o 0,5 a spokojnosť o 1 za minútu, nikdy však pod 15 – mačka nikdy nie je „zanedbaná".
- Keď má mačka vyliečené všetky diagnózy, zdravie samo rastie o 2 za minútu (zotavovanie).
- Zdravie ani dôvera samy neklesajú.

---

## 4. Fáza 2 – Liečba a rehabilitácia (Care)

### 4.1 Diagnostika 🟢 MVP
Diagnózy sú pri príchode **skryté** (zobrazené ako „?"). Hráč ich odhaľuje nástrojmi:

| Nástroj | Odhaľuje | Dostupné od |
|---|---|---|
| Ruka (prehliadka) | Viditeľné: kliešte, zranenie, špina, blchy, dlhé pazúriky | Fáza 1 |
| Teplomer | Horúčka / infekcia | Fáza 1 |
| Stetoskop | Pľúca: nádcha (liečba: inhalácia) | Fáza 1 |
| Otoskop | Ušné infekcie, roztoče | Fáza 2 |
| Laboratórium (krv) | Parazity, choroby | Fáza 3 |
| Röntgen | Zlomeniny, prehltnuté predmety | Fáza 3 |
| CT | Vzácne stavy (zberateľské diagnózy) | Fáza 4 |

### 4.2 Liečebné minihry
Každá minihra: **5–20 sekúnd**, ovládanie myšou/dotykom, hodnotenie 1–3 hviezdičky (vplýva na rýchlosť liečby, nikdy neznemožní vyliečenie).

| Minihra | Mechanika | Rozsah |
|---|---|---|
| **Vyťahovanie kliešťov** | Nájdi v srsti, chyť pinzetou, ťahaj pomaly (ukazovateľ napätia) | 🟢 MVP |
| **Obväzovanie labky** | Krúživý pohyb okolo labky, správny počet otočení | 🟢 MVP |
| **Čistenie ušiek** | Utieraj tampónom, kým nie je čisto (stieranie masky) | 🟢 MVP |
| **Podávanie sirupu** | Načasuj stlačenie, keď mačka otvorí papuľku | 🟢 MVP |
| **Inhalácia** | Drž prst pri nádychu (kruh rastie), pusti pri výdychu – 3 dychy | 🟢 MVP |
| **Kúpanie** (blchy) | Napeniť celú mačku, potom penu opláchnuť – blšky odskočia | 🟢 MVP |
| **Očkovanie** | Nájdi správne miesto, odvráť pozornosť maškrtou | 🟡 v1.0 |
| **Strihanie pazúrikov** | Čiarka sa posúva po pazúriku – ťukni na bielej špičke, nie na ružovej dreni | 🟢 MVP |
| **Rehabilitácia v bazéne** | Veď mačku vo veste pomedzi bóje | 🔵 Neskôr |

### 4.3 Socializácia 🟢 MVP
Zvyšuje **Dôveru**. Účinnosť závisí od povahy:

| Aktivita | Minihra | Plachá | Maznavá | Divoká | Maškrtná | Hravá |
|---|---|---|---|---|---|---|
| Hra s perom | Kývaj prútikom, mačka loví | ×0.5 | ×1 | ×1.5 | ×1 | ×2 |
| Česanie | Ťahaj kefou v smere srsti | ×1 | ×2 | ×0.5 | ×1 | ×1 |
| Kŕmenie z ruky | Podrž maškrtu, nehýb sa | ×1.5 | ×1 | ×1 | ×2 | ×1 |
| Tiché sedenie | Nerob nič 10 s (pasívne) | ×2 | ×0.5 | ×1.5 | ×0.5 | ×0.5 |

> Hráč spoznáva povahu skúšaním – ✨ pri úspechu, 💢 pri nevhodnej aktivite. Odhalená povaha sa zapíše do karty mačky.

### 4.4 Povahové rysy a plemená 🟢 MVP (15 rysov, 12 plemien)
Mačka má 1–2 rysy, odhaľujú sa pri socializácii (aktivita, ktorá jej sedí / nesedí) alebo pri adopcii. Socializačné násobky sú v `traits.json`.

| Rys | Účinok na hru | Hodí sa (adoptéri) | Nehodí sa |
|---|---|---|---|
| Plachá | Prichádza s nízkou dôverou, miluje tiché sedenie | pokojná domácnosť, bez detí | deti, iné zvieratá |
| Maznavá | Miluje česanie; v kaviarni väčšie dary | veľa doma | málo doma |
| Divoká | Nízka dôvera, miluje pero | záhrada, skúsený | byt, deti |
| Maškrtná | Jedlo dáva +50 % spokojnosti | – | – |
| Hravá | Viac sa prechádza, miluje pero | deti, aktívni | seniori |
| Leňoch | Viac leží, rád sa nechá česať | seniori, byt | aktívni |
| Zvedavá | Viac sa prechádza | aktívni, záhrada | pokojná domácnosť |
| Ukecaná | Miluje kŕmenie z ruky | veľa doma, seniori | pokojná domácnosť |
| Nezávislá | Spokojnosť klesá o polovicu pomalšie | málo doma, byt | veľa doma |
| Nežná | Rada sa nechá česať | deti, seniori | – |
| Odvážna | Miluje pero | iné zvieratá, záhrada | – |
| Múdra | Pero aj kŕmenie z ruky | skúsený | málo doma |
| Mrzutá | Nízka dôvera, iba tiché sedenie pomáha | skúsený, pokojná domácnosť | deti |
| Spoločenská | Rada sa nechá česať; v kaviarni väčšie dary | iné zvieratá, deti | málo doma |
| Lovkyňa | Viac sa prechádza, pero ×2 | záhrada | byt |

**Plemená** (`breeds.json`): domáca krátkosrstá a dlhosrstá, európska, britská, perzská, mainská mývalia, nórska lesná, škótska klapouchá (bežné farby) a ruská modrá, siamská, ragdoll, sfinga (vlastná pevná farba).
- Vzácnejšie plemeno = **vyšší adopčný príspevok** (+15 % za každý stupeň vzácnosti).
- Dlhosrsté plemená sa zašpinia o 50 % rýchlejšie, sfinga takmer vôbec.
- Farby: 10 bežných (čierna, ryšavá, mourovatá, sivá, smokingová, trojfarebná, krémová, biela, čokoládová, modrosivá) + 3 vlastné (tmavé/svetlé odznaky, bez srsti).
- Fantasy farby z balíka (ružová, duch, „radioaktívna"…) sú rezervované na udalosti (napr. Halloween).

---

## 5. Fáza 3 – Adopcia (Matching)

### 5.1 Adoptéri 🟢 MVP
Adoptér je postava s kartou:
- **Meno, portrét, krátky popis** – „Babka Mária, 72 rokov, byt na sídlisku"
- **Domácnosť (tagy):** byt / dom so záhradou, deti, iné zvieratá, veľa doma / málo doma
- **Želanie (voľný text + skryté preferencie):** „Hľadám pokojnú spoločníčku na gauč"
- **Výnimky (dealbreakery):** napr. „žiadne mačiatka"

### 5.2 Výpočet zhody 🟢 MVP
```
zhoda = základ 50
      + Σ (rys mačky zodpovedá tagu domácnosti)   × +15
      + Σ (rys mačky odporuje tagu domácnosti)    × −20
      + (vek zodpovedá preferencii)               × +10
      + (vzhľad zodpovedá „vizuálnemu želaniu")   × +5
      − dealbreaker → zhoda = 0, adopcia odmietnutá
```
- **≥ 80 %** – Dokonalá zhoda: plná odmena + zaručená pohľadnica
- **50–79 %** – Dobrá zhoda: čiastočná odmena, pohľadnica s 50 % šancou
- **< 50 %** – Hráč dostane upozornenie („Nie som si istý/á…") a môže si to rozmyslieť. Zlá adopcia = mačka sa po pár dňoch **vráti** (smutnejšia, nižšia dôvera), mierna strata reputácie. Nikdy nie trest smrťou alebo stratou mačky.

> Pohovor (🟡 v1.0): hráč môže adoptérovi položiť 1–2 otázky a odhaliť skryté preferencie.

### 5.3 Odmeny za adopciu
| Odmena | Popis |
|---|---|
| **Adopčný príspevok** | Peniaze (napr. 50–150 € podľa zhody a fázy) |
| **Reputácia** | Odomyká granty, väčšie hlásenia, lepších adoptérov |
| **Pohľadnica** 🟢 MVP | 2–5 minút po adopcii príde ilustrovaná pohľadnica: mačka v novom domove + krátky odkaz od majiteľa. Ukladá sa do albumu. |
| **Zápis do albumu** | Odomknutie plemena/farby/príbehu |

### 5.4 Stálice – mačky, ktoré si hráč nechá 🟢 MVP
Adopcia **nie je povinná**. Vyliečenú mačku si hráč môže nechať ako **stálicu**.

- Stálica sa presťahuje z klietky do **mačacieho kútika** (Fáza 1) / **mačacej kaviarne** (od Fázy 2) a **uvoľní klietku** pre ďalšiu záchranu.
- **Úžitok stálic:**
  - **Dary od návštevníkov** – každá stálica prináša priebežný príjem (Fáza 1: 0,5 €/min, kaviareň ho násobí). Spokojnejšia stálica = viac darov.
  - 🟡 **Pomocníčka** – stálica s rysom „maznavá" upokojuje nové plaché mačky (rýchlejšia dôvera).
  - 🟡 Obliekanie, fotky, mená v kaviarni.
- **Obmedzenie je iba miesto** – kútik má 2 miesta, kaviareň +3 (§5.5); rozširuje sa za peniaze. Žiadny trest za nechanie si mačky.
- Stálicu je možné **kedykoľvek neskôr dať na adopciu** (napr. keď príde ideálny záujemca).
- Stálica sa zapíše do albumu ako „Naša" – album sa dá dokončiť aj bez adopcií, ale pohľadnice existujú iba z adopcií.

> Vzniká jemné napätie „chcem si ju nechať" vs. „chcem vidieť, ako je šťastná u babky" – emocionálne, nie stresujúce.

### 5.5 Mačacia kaviareň 🟢 MVP (už vo Fáze 1)
Druhá miestnosť vedľa garáže. Kúpi sa v menu ☰ → Obchod (**350 €**). Prepína sa tlačidlom ☕ / 🏥 v hornom paneli.

- **Stálice sa presťahujú do kaviarne.** Kaviareň pridá **+3 miesta** pre stálice a **zdvojnásobí** ich priebežné dary.
- **Hostia** prichádzajú v reálnom čase (každú ~minútu), keď je v kaviarni aspoň jedna stálica. Sadnú si k voľnému stolu (na začiatku 2 stoly, dokúpiť ďalšie 2).
- Hosť si objedná (☕ káva, 🍵 čaj, 🍰 koláč) – bublina nad hlavou. **Ťuknutím ho obslúžiš.** Pohladká si mačku (stálica +spokojnosť).
- Po ~minúte odíde a nechá **dar**: základ + bonus za každú stálicu (spokojnejšia = viac). Obslúžený hosť dá **1,5×** viac.
- **Bez trestu:** neobslúžený hosť nič nezničí, iba nechá menší dar. Hostia nečakajú v rade a nikto sa nehnevá (cozy, §2.2).
- **V noci (22:00–6:00) je kaviareň zatvorená** – noví hostia neprídu, sediaci v pokoji dopijú; mačky spia. Noc plynie 3× rýchlejšie (`balance.json → clock.night_seconds_per_game_hour`), takže netrvá dlho.
- Offline hostia neprichádzajú – bežia iba priebežné dary stálic (×2, max. 8 h).
- Nová výzva: „Obslúž X hostí" (iba keď je kaviareň otvorená).
- Balans je v `balance.json → cafe`.

---

## 6. Fáza 4 – Rozširovanie (Progression)

### 6.1 Ekonomika 🟢 MVP
| Mena | Ako ju získať | Na čo ju míňať |
|---|---|---|
| **Peniaze (€)** | Adopčné príspevky (vzácne plemená viac), dary stálic, hostia v kaviarni, odmeny za výzvy | Rozšírenie (klietky, kútik, kaviareň, stoly), **vybavenie**, **dekorácie**, neskôr Fáza 2 |
| **Reputácia (★)** | Adopcie (lepšia zhoda = viac), výzvy | **Nemíňa sa – je to úroveň**, ktorá odomyká (§6.1.1) |
| **Srdiečka (❤️)** 🔵 neskôr | Pohľadnice, album | Kozmetika (oblečenie mačiek, farby stien) |

**Dva zdroje príjmu, dva štýly hrania:** kto rád adoptuje, zarába hlavne príspevkami a zbiera pohľadnice; kto si mačky necháva, zarába pomalšie, ale stabilne z kaviarne – aj keď nehrá.

**Bez prevádzkových nákladov.** Krmivo a bežná starostlivosť sú zadarmo – peniaze sa míňajú iba na rast a krásu. Nikdy bankrot.

Všetko sa kupuje v menu ☰ → **🛒 Obchod** (ťuknutie na ★ v hornom paneli ho tiež otvorí).

#### 6.1.1 Úrovne útulku (★) 🟢
| Úroveň | ★ | Názov | Odomkne |
|---|---|---|---|
| 1 | 0 | Garážová záchranka | vybavenie 1. stupňa, prvé dekorácie |
| 2 | 25 | Známa v susedstve | **mačacia kaviareň**, vybavenie 2. stupňa, ďalšie dekorácie |
| 3 | 60 | Obľúbený útulok | vybavenie 3. stupňa, ďalšie dekorácie, o 1 záujemcu viac naraz |
| 4 | 110 | Pýcha mesta | vzácne plemená prichádzajú 2× častejšie, **Komunitný útulok** |
| 5 | 220 | Špecializovaná klinika | **personál**, **klinika** |
| 6 | 450 | Regionálne centrum | **catio**, **mačací hotel** |
| 7 | 800 | Národné centrum felíd | **2. poschodie kliniky** (CT, bazén), **edukačné centrum** |

Pri novej úrovni: oznámenie, iskričky a zoznam toho, čo sa odomklo. Úrovne sú v `balance.json → levels`.

#### 6.1.2 Vybavenie 🟢
Každý kus má 3 stupne (2. a 3. stupeň odomyká úroveň ★). Je ho vidieť v garáži. Dáta: `equipment.json`.

| Vybavenie | Účinok (stupeň 1 / 2 / 3) | Ceny |
|---|---|---|
| 🥣 Automatické kŕmidlo | prestávka medzi kŕmením −30 % / −50 % / −65 % | 80 / 180 / 350 € |
| 🌳 Mačací strom | spokojnosť klesá pomalšie −20 % / −35 % / −50 % | 100 / 200 / 380 € |
| 💊 Lekárnička | rýchlejšie uzdravovanie ×1,5 / ×2 / ×2,5 | 120 / 240 / 420 € |
| 🧶 Hračky | socializácia +15 % / +30 % / +50 % dôvery | 90 / 190 / 360 € |
| 🛏️ Pelechy | priebežné dary stálic +20 % / +40 % / +60 % | 150 / 300 / 500 € |

#### 6.1.3 Dekorácie a útulnosť 🟢
Dekorácie sa kupujú jednotlivo a objavia sa na pevnom mieste v garáži alebo v kaviarni. Každá pridá **útulnosť** (❤ bodov). Dáta: `decor.json`.
- **Útulnosť garáže** → mačky rýchlejšie získavajú dôveru (+1 % za bod).
- **Útulnosť kaviarne** → hostia dávajú väčšie dary (+2 % za bod).
- Niektoré dekorácie odomyká úroveň ★.

#### 6.1.4 Rozšírenie útulku
- **Fáza 1:** 3. a 4. klietka (120 / 180 €), kútik pre stálice +1 / +2 (150 / 220 €), kaviareň (350 €, od 25 ★), 3. a 4. stôl (180 / 260 €).
- **Fáza 2 – Komunitný útulok** 🟢 (od 110 ★ a 10 záchran, 1 500 €): tretia budova vedľa garáže a kaviarne – **garáž aj kaviareň zostávajú**, hráč nič nestratí. Prepínanie miestností cez ponuku v hornom paneli.
  - **Karanténa:** +4 klietky (spolu až 8 pacientov). Keď je garáž plná, nová mačka ide do karantény; pacienta možno presúvať tlačidlom na karte.
  - **Ambulancia:** nástroj **otoskop** → diagnóza **ušné roztoče** (minihra kvapky do uška); **očkovanie** zdravej mačky (minihra: upokojiť hladkaním, ťuknúť na krk) → pri adopcii +25 % príspevok a +3 ★. Dobrovoľné, bez trestu.
  - **Mačacia rodinka:** nové hlásenie – mama a 2–3 mačiatka rovnakej farby naraz (potrebuje až 4 klietky).
  - Nová výzva „Zaočkuj mačky". Balans: `balance.json → shelter`.

### 6.2 Fázy rastu útulku
| Fáza | Názov | Podmienka odomknutia | Kapacita | Nové prvky |
|---|---|---|---|---|
| **1** 🟢 | Garážová záchranka | štart | 2 klietky → max 4, kútik pre 2 stálice | Stôl, misky, teplomer, ruka, stetoskop. Pomocníčka: dobrovoľníčka **Zuzka** (tutoriál). |
| **2** 🟢 | Komunitný útulok | 10 záchran, ★ 110, 1 500 € | 8–12 | Prenajatý domček: karanténa, **mačacia kaviareň** pre stálice (násobí dary), ambulancia na očkovanie, otoskop |
| **3** 🟢 | Špecializovaná klinika | ★ 220 (úroveň 5), Komunitný útulok, 1 200 € | – (liečba, nie klietky) | Personál (veterinár, ošetrovateľ, správca sociálnych sietí), laboratórium, röntgen, operačná sála, catio (vonkajší výbeh) |
| **4** 🔵 | Národné centrum felíd | 120 záchran, ★ 2000 | 50+ | Viac poschodí, CT, rehabilitačný bazén, mačací hotel, edukačné centrum (školské výlety) |

> **MVP obsahuje iba Fázu 1** a „okno" do Fázy 2 (zamknutá budova, ktorú hráč vidí na mape – motivácia).

### 6.3 Stavba a umiestňovanie 🟡 v1.0
- Mriežkový systém (grid), miestnosti sa kreslia ťahaním (ako v Two Point Hospital).
- Každá miestnosť má povinné predmety (napr. ambulancia = stôl + skrinka s liekmi).
- Dekorácie zvyšujú **Spokojnosť** mačiek v miestnosti a atraktivitu pre návštevníkov.

### 6.4 Personál 🟢 (úroveň 5, 220 ★)
Personál sa najíma **raz** v Obchode (bez mzdy) a dá sa kedykoľvek poslať na voľno. Hráč môže stále všetko robiť aj sám.

| Rola | Cena | Čo robí sám |
|---|---|---|
| 🧺 Ošetrovateľ Peťo | 600 € | Nakŕmi hladnú mačku (spokojnosť < 60) alebo učeše špinavú (čistota < 45), raz za 8 s |
| 🩺 Veterinárka Hanka | 800 € | Raz za 6 s vyšetrí jedným nástrojom mačku v klietke a odhalí diagnózu – **liečbu (minihry) robí hráč** |
| ☕ Baristka Ema | 500 € | Obslúži hosťa, ktorý čaká dlhšie ako 8 s (dar o niečo menší ako pri obsluhe hráčom). Potrebuje kaviareň |
| 📱 Správca sietí Tomáš | 700 € | Záujemcovia chodia častejšie (×0,6), čaká ich o 1 viac a častejšie prídu tí, čo sa k mačke hodia najlepšie |

Hodnoty sú v `balance.json → staff`. Personál chodí po miestnosti, kde pracuje, a pri práci ukáže ikonku nad mačkou.

> Kľúčové pravidlo: **automatizácia nikdy nezoberie hráčovi zábavné časti**. Personál robí rutinu, hráč môže vždy zasiahnuť sám (a dostať lepší výsledok).


### 6.5 Klinika 🟢 (úroveň 5, 220 ★)
Štvrtá budova vedľa útulku (treba Komunitný útulok). Najprv sa postaví budova (**1 200 €**), potom sa v Obchode dokupujú miestnosti. Nekúpené sú zakryté plachtou (ťuknutím sa otvorí obchod).

| Miestnosť | Cena | Čo prináša | Diagnózy |
|---|---|---|---|
| 🔬 Laboratórium | 1 500 € | nástroj **Krvný test** (minihra: ťuknúť na 3 zvláštne bunky v mikroskope) | cukrovka (inzulín – injekcia), choroba obličiek (iba staršie mačky, sirup), zápal močových ciest (sirup) |
| 🩻 Röntgen | 2 000 € | nástroj **Röntgen** (minihra: podržať rám nad vrtiacou sa mačkou, potom ťuknúť na problém na snímke) | zlomená labka (minihra **Dlaha** – krúživé omotávanie, príliš rýchlo = príliš tesne), prehltnutý predmet |
| 🩺 Operačná sála | 2 500 € | minihra **Operácia** (uspať – ručička v zelenom, vybrať predmet pinzetou pomaly, zašiť ťukaním na bodky) | prehltnutý predmet; **kastrácia** dospelej zdravej mačky (voliteľne) |

- Nové diagnózy dostanú mačky iba vtedy, keď ich hráč má čím odhaliť; prehltnutý predmet iba s operačnou sálou.
- **Prípad z inej útulne** 💗 – nové hlásenie (s laboratóriom alebo röntgenom), mačka má aspoň jednu diagnózu kliniky; pri adopcii +2 ★ a príspevok +25 %.
- **Kastrácia:** pri adopcii +1 ★, príspevok +15 % a zhoda s adoptérom +6.
- **Klinika žije:** ťuknutím na mikroskop, röntgen alebo operačný stôl sa vyberie pacient. Pri zákroku mačka leží na stole (záblesk röntgenu, bublinky v laboratóriu, jasnejšia lampa), po operácii si poleží na pelechu so zotavením; veterinárka chodí k stolu, prístroje blikajú.
- Veterinárka (personál) robí aj krvný test a röntgen automaticky a presťahuje sa na kliniku. Operácie, dlahu a liečbu robí vždy hráč.


### 6.6 Catio – vonkajší výbeh 🟢 (úroveň 6, 450 ★)
- Kúpa v Obchode za **2 000 €**, treba kaviareň. Piata miestnosť (ikona 🌳): tráva, plot so živým plotom, stromček, prelézačka, búdka, napájadlo, záhradné lampy, motýle a vtáčiky na plote.
- Stálice samy chodia cez deň von a späť do kaviarne (každých ~12 s sa niektoré rozhodnú); v noci sú všetky vnútri.
- Účinok: stáliciam s výbehom klesá spokojnosť **o polovicu pomalšie** (`balance.json → catio`), takže prinášajú viac darov.


### 6.7 Mačací hotel 🟢 (úroveň 6, 450 ★)
- Šiesta miestnosť (🏨), kúpa v Obchode → Stavby za **2 500 €**; na začiatok 2 apartmány, dokúpiť ďalšie 3 (900 / 1 400 / 2 000 €).
- Cez deň, keď je voľný apartmán, príde majiteľ s mačkou (~každých 70 s) a nechá ju u nás na 4–7 minút. Hosť nie je naša mačka – nedá sa adoptovať ani liečiť, iba sa oň staráme (kŕmenie, česanie, hra). Ošetrovateľ Peťo pomáha aj v hoteli.
- Hosťom klesá spokojnosť 1,5× rýchlejšie (chýba im domov). Majiteľ zaplatí **140 € × (0,5 + priemerná spokojnosť/100)**; pri priemere aspoň 75 % pridá **+1 ★**.
- Hostia si občas ľahnú do apartmánu, v noci tam spia. Prehľad hotela ukazuje, kedy kto odchádza a ako je spokojný; karta hosťa má záložku Pobyt.


### 6.8 Klinika – 2. poschodie: CT a rehabilitačný bazén 🟢 (úroveň 7, 800 ★)
- „Viac poschodí": klinika dostane **2. poschodie** (3 000 €, Obchod → Stavby), vlastná miestnosť 🏢 so schodmi.
- **CT** (3 000 €): nový nástroj. Minihra – držať prst, prstenec skenuje; keď sa mačka zavrtí (!), treba pustiť, inak je snímka rozmazaná. Odhalí **srdcovú chorobu** (dospelé a staršie, liečba tabletkami – sirup) a **ochorenie chrbtice**.
- **Rehabilitačný bazén** (2 500 €): minihra **Plávanie** – striedavo ťukať ľavou a pravou labkou, mačka v plávacej veste preplává bazén. Lieči ochorenie chrbtice (bez bazéna sa nedá – mačky ho bez bazéna ani nedostanú) a ponúka **rehabilitáciu** po zlomenine, operácii alebo chrbtici: +20 zdravia, pri adopcii príspevok +10 %.
- Prístroje sú ťuknuteľné ako na prízemí, mačka leží na stole CT alebo pláva v bazéne; veterinárka robí CT aj sama.


### 6.9 Edukačné centrum 🟢 (úroveň 7, 800 ★)
- Kúpa v Obchode → Stavby za **3 000 €**, treba kaviareň. Miestnosť 🎓: tabuľa s nakreslenou mačkou, lavičky, plagáty, koberec na hranie.
- Cez deň (nie večer a v noci) príde asi každé 3,5 minúty **školský výlet** (3–5 detí s pani učiteľkou). Deti si sadnú a čakajú 2,5 minúty.
- **Prednáška** = minihra **Kvíz**: 3 otázky o starostlivosti o mačky (z 10), tri odpovede. Hviezdičky = správne odpovede (aspoň 1).
- Odmena: dar 15 € za každé dieťa, ★ podľa výsledku (1 / 1 / 2), stálice sa potešia (deti sa s nimi pohrajú na koberci) a **záujemca o adopciu príde hneď**. Bez prednášky výlet odíde s polovičným darom.

---

## 7. Retenčné mechaniky

### 7.1 Kniha záchranárskych príbehov (Album) 🟢 MVP
- Mriežka slotov: **plemená × farby/vzory** + špeciálne strany (vzácne diagnózy, udalosti, seniori).
- Každá adoptovaná mačka = stránka: portrét pred/po, meno, povaha, príbeh, pohľadnice.
- Percentá dokončenia a odmeny za dokončené strany (dekorácie, nové typy hlásení).
- **84 políčok** (menu ☰ → Album): 8 bežných plemien × 10 farieb + 4 plemená s vlastnou farbou. Zapisuje sa prvá mačka každého políčka, ďalšie zvyšujú počítadlo ×N.

### 7.2 Vzácne mačky 🟢
- Vzácne znaky (`balance.json → rare`): **rôznofarebné oči** (2 %), **palčiaky** – 6 prstov (2,5 %), **trojfarebný kocúr** (12 % trojfarebných mačiek). Od úrovne 4 (vzácne plemená) 2× častejšie.
- Vzácna mačka sa občas zaligoce zlatou iskričkou, na karte má ✨. Pri adopcii **príspevok +30 % a +3 ★**; pri adopcii alebo ako stálica vyplní políčko na strane **Vzácnosti** v albume (+5 ❤).



### 7.3 Výzvy a udalosti
**Nástenka výziev** 🟢 MVP (menu ☰ → Výzvy) – 3 aktívne úlohy bez časového limitu. Odmenu si hráč vyzdvihne ťuknutím; na miesto výzvy príde nová. Každá ďalšia výzva rovnakého typu má vyšší cieľ (`public/data/challenges.json`). Príklady:
- „Zachráň 3 mačiatka", „Nájdi domov pre plachú mačku", „Maj 2 stálice naraz", „Vylieč 5 kliešťových pacientov"
- Odmena: peniaze, ★, neskôr srdiečka a dekorácie.

**Udalosti** 🟡 v1.0 – prídu ako ponuka, hráč ich môže prijať alebo odložiť. Majú voliteľný časovač s bonusom navyše, **nikdy nezlyhajú**:

| Udalosť | Mechanika | Odmena |
|---|---|---|
| **Zima prichádza** | 2× viac hlásení, podchladené mačky (nová diagnóza), vyhrievané pelechy | Zimné dekorácie, strana albumu |
| **Záchrana z množiarne** | 15 mačiatok naraz, dočasné klietky, pomoc susedov | Veľký grant, ★ |
| **Deň otvorených dverí** | 3× viac návštevníkov kaviarne a adoptérov | Peniaze, ★ |
| **Povodne** | Mokré, vystrašené mačky, núdzová kapacita | Unikátne pohľadnice |

**Implementované (🟢)** – `public/data/events.json`: ponuka príde asi každých 20 minút hrania (prvá po ~5 min od úrovne 2), v hornom paneli bliká pilulka s ikonou udalosti. Hráč ju **prijme** alebo dá **Neskôr** (ďalšia o 10 min). Počas udalosti pilulka odpočítava čas. Na konci vždy základná odmena, za splnený cieľ bonus.

| Udalosť | Od | Trvanie | Účinok | Cieľ (bonus) | Odmena |
|---|---|---|---|---|---|
| ❄️ Zima prichádza | úroveň 2 | 10 min | hlásenia 2× častejšie, nová diagnóza **podchladenie** (teplomer, zahriať v deke), sneh | zachrániť 4 mačky | 120 € + 5 ★ (+150 € + 5 ★) |
| 🎈 Deň otvorených dverí | úroveň 2, kaviareň | 8 min | hostia kaviarne 2,5× častejšie, záujemcovia ~3× častejšie a o 1 viac, girlandy | 2 adopcie | 100 € + 5 ★ (+200 € + 8 ★) |
| 🏚️ Záchrana z množiarne | úroveň 4, útulok | 15 min | hneď príde mama s 4–5 mačiatkami, +4 dočasné klietky v karanténe | vyliečiť 6 diagnóz | 300 € + 8 ★ (+300 € + 10 ★) |
| **Sezónne** (Vianoce, Halloween…) 🔵 | Kozmetika, tematické mačky | Dekorácie |

### 7.4 Vizuálna spätná väzba 🟢 MVP
Každá mačka má **3 vizuálne stavy** (pre MVP stačí kombinácia sprite + overlay):
1. **Príchod:** špinavý overlay, sklopené uši, chvost pod sebou, schovávanie v rohu klietky
2. **Zotavovanie:** čistá, obväzy, sedí pri mreži, zvedavá
3. **Pripravená:** lesklý efekt (particle ✨), pradenie (zvuk + vibrácia sprite), hrá sa, spí na chrbte

Pri prechode stavu: krátka „premena" s efektom a zvukom (dopamínový moment).

### 7.5 Ďalšie háčiky
- 🟡 **Denné maličkosti (podľa skutočného dátumu):** prvá maškrta dňa pre všetky mačky (bonus spokojnosti), „mačacie prekvapenie" (mačka spí na nečakanom mieste).
- 🟡 **Fotografický režim:** odfoť mačky v herni, ulož do albumu.
- 🔵 **Návštevy adoptovaných mačiek:** občas sa bývalý majiteľ zastaví s mačkou na kontrolu.


### 7.5 Úspechy (achievementy) 🟢
- 24 úspechov v menu ☰ → **🏆 Úspechy** (`public/data/achievements.json`): záchrany (1 / 10 / 50 / 150), adopcie (1 / 25 / 100), dokonalé zhody, plaché mačky, mačiatka, liečba, socializácia, kŕmenie, kaviareň, očkovanie, kastrácia, hotel, prednášky, stálice, album (25 aj celý), úroveň 7, celý personál, všetky budovy.
- Každý má odmenu v € (20 – 1 000), ktorá sa pripíše hneď pri odomknutí (oznámenie 🏆). Neodomknuté ukazujú postup.
- Staré uložené hry dostanú úspechy za to, čo už hráč dokázal, hneď pri načítaní.


### 7.6 Srdiečka ❤ a kozmetika 🟢
- **Srdiečka** sa nedajú kúpiť za €: +3 za pohľadnicu, +2 za nové políčko albumu, +5 za vzácnu mačku v albume, +5 za úspech, +3 za splnený cieľ udalosti (`public/data/cosmetics.json → hearts`).
- **Obchod → ❤️ Ozdoby:** za srdiečka sa kupujú farby stien. (Ozdoby na mačkách – obojky, mašličky – boli skúšobne pridané a odstránené: pôsobili neprirodzene.)
- **Farba stien** garáže a kaviarne (mätová, levanduľová, broskyňová, nebeská – po 8 ❤); kúpená farba sa dá použiť v oboch miestnostiach a kedykoľvek vrátiť pôvodnú.

---

## 8. Naratív a tón

- **Hlavná postava:** hráč (bez pohlavia, voliteľné meno), ktorý našiel prvé mačiatko a „nejako sa to celé začalo".
- **Zuzka** – dobrovoľníčka, tutoriál, priateľský komentár. Neskôr vedúca ošetrovateľov.
- **Pán Kováč** – mrzutý sused z garáže, ktorý sa postupne obmäkčí (a nakoniec si adoptuje mačku – emočný míľnik konca Fázy 1).
- **Tón:** teplý, jemný humor, nikdy nie ponurý. Ťažké témy (týranie, množiarne) sa spomínajú, ale nezobrazujú – hra sa sústreďuje na záchranu, nie na utrpenie.
- **Jazyk:** slovenčina + angličtina od začiatku (lokalizácia cez JSON súbory v `src/i18n/`). Žiadny text natvrdo v kóde.

---

## 9. Umenie, zvuk a UX

### 9.1 Rozhodnutie o vizuálnom štýle
**Rozhodnutie: 2D pixel-art, pohľad zhora v 3/4 perspektíve (top-down, ako Stardew Valley), mriežka 32×32 px.**

Mriežka 32×32 bola zvolená preto, lebo v nej existujú free assety pre všetky kľúčové časti (domáci interiér, nemocničné vybavenie, mačky, ľudia) a mačky sú pri nej dosť veľké na čitateľné emócie aj na mobile. Konkrétne balíky → `docs/ASSETS.md`.

Dôvody:
- Najväčšia ponuka **kvalitných free assetov** (interiéry, nábytok, postavy, mačky) – izometrických free balíkov je výrazne menej a ťažko sa kombinujú.
- Jednoduchšia stavba miestností na mriežke.
- Konzistencia: pixel-art z rôznych balíkov sa ľahšie zladí jednotnou paletou ako pastelové ilustrácie.

Alternatíva (pastelový 2D štýl à la Good Pizza) sa ponecháva pre **minihry a pohľadnice** – detailné ilustrácie mačiek pri liečbe môžu byť vo väčšom rozlíšení. Rozhodnutie sa potvrdí po prototype (míľnik M1).

**Paleta:** zvoliť jednu paletu (napr. z Lospec) a všetky assety cez ňu prefarbiť → jednotný vzhľad aj z rôznych zdrojov.

### 9.2 Zvuk
- **Hudba:** cez deň lo-fi (3 skladby), večer a v noci pokojné skladby (3); striedajú sa náhodne a neopakujú hneď po sebe. Ďalšie skladby sa načítajú až po spustení hry.
- **SFX:** pradenie (kľúčový zvuk!), mňaukanie (rôzne podľa nálady), syčanie, kroky, UI kliky, „premena" jingle.
- Všetky zdroje a licencie → `docs/ASSETS.md` a `CREDITS.md`.

### 9.3 UI/UX zásady
- Ovládanie **jednou rukou / myšou** – pripravené na mobil.
- Karta mačky dostupná jedným klikom: štatistiky, odhalené rysy, diagnózy, príbeh.
- Farebné kódovanie potrieb (ikonky nad hlavou mačky).
- **Hlavné menu** 🟢 pri spustení: logo, ▶ Hrať / Pokračovať, ⚙️ Nastavenia (zvuk, jazyk), ↺ Nová hra (s potvrdením), 🚪 Ukončiť hru (iba Android). Herný čas kým je menu otvorené stojí.
- **Pauza** 🟢 – tlačidlo ⏸ v hornom paneli (na PC aj Escape, na Androide tlačidlo Späť): Pokračovať, zvuk, jazyk, štatistiky, 🏠 Hlavné menu, 🚪 Ukončiť hru (Android, s potvrdením). Čas v hre stojí.
- **Tlačidlo Späť (Android)** zavrie to, čo je navrchu: minihru, okno, výber mačky; inak otvorí pauzu. V hlavnom menu hru ukončí. Hra sa ukladá sama, ukončenie nič nestratí.
- Menu ☰ obsahuje herný obsah: Výzvy, Úspechy, Album, Pohľadnice, Obchod.
- **Písmo:** všade čitateľné Nunito (nadpisy hrubším rezom). Pixelové písmo sa pri malých veľkostiach rozmazávalo.
- Prístupnosť: veľkosť písma, režim pre farboslepých (ikony + farby, nie len farby), možnosť vypnúť časový tlak („Pokojný režim").

---

## 10. Technická špecifikácia

### 10.1 Technológie
| Oblasť | Voľba | Prečo |
|---|---|---|
| Jazyk | **TypeScript** (strict) | Typová kontrola, rovnaký kód pre web, PC aj mobil |
| Herná knižnica | **Phaser** (WebGL) | Zrelá 2D knižnica: sprity, animácie, tilemapy, vstup myšou aj dotykom, zvuk |
| Build | **Vite** | Rýchly vývojový server, produkčný build do statických súborov |
| Mapy útulku | **Tiled** (free editor) → JSON | Phaser načítava Tiled mapy priamo; vizuálny editor miestností |
| PC | **Tauri** (alternatíva Electron) | Malé natívne aplikácie pre Windows/macOS/Linux, Steam |
| Mobil | **Capacitor** | Zabalí webovú hru do Android/iOS aplikácie |
| Dáta | JSON v `public/data/` | Balansovanie bez zásahu do kódu |
| Lokalizácia | JSON slovníky `src/i18n/sk.json`, `en.json` | Jednoduché, bez závislostí |
| Testy | **Vitest** | Testy hernej logiky bez prehliadača |
| Verzovanie | Git + GitHub; assety v súkromnom podmodule | Licencie assetov zakazujú ich verejné šírenie |
| CI | GitHub Actions: build + testy pri PR, nasadenie webovej verzie na GitHub Pages z `main` | Každá verzia hrateľná cez odkaz aj na mobile |
| Úlohy | GitHub Issues + GitHub Projects (Kanban) | Všetko na jednom mieste |

### 10.2 Architektúra (vysoká úroveň)
```
src/
  core/        (čistá logika – bez Phaseru a bez DOM, testovateľná)
    GameState      – mačky, stálice, peniaze, reputácia, hlásenia, adoptéri, pohľadnice
    Clock          – hodiny pre atmosféru (deň/noc)
    systems/       – CatGenerator, Care (prehliadka, liečba, socializácia), Match, Simulation (čas, offline)
    SaveManager    – ukladanie/načítanie (JSON, verzovaný formát, migrácie)
    EventBus       – typované globálne udalosti (catAdmitted, catAdopted, postcardArrived…)
  data/        typy a výrezy spritov
  scenes/      (Phaser – herný svet a minihry)
    BootScene, GarageScene, minigames/ (jedna scéna = jedna minihra)
  ui/          (HTML/CSS nad plátnom – panel, karty, dialógy, zoznamy)
  i18n/        sk.json, en.json
```
**Rozhranie je HTML/CSS** položené nad plátnom Phaseru: karty, zoznamy a dialógy sa tak robia rýchlo, text je ostrý na každom displeji a rozloženie sa ľahko prispôsobí mobilu. Phaser kreslí iba svet (garáž, mačky) a minihry.

**Zásada:** všetka herná logika žije v `src/core/` a nezávisí od Phaseru. Phaser scény iba zobrazujú stav a posielajú akcie hráča. Vďaka tomu sa logika dá testovať, ukladať a v prípade potreby preniesť inam bez prepisovania.

### 10.3 Ukladanie hry 🟢 MVP
- Automatické uloženie každých 15 s, po každej dôležitej akcii a pri zatvorení/skrytí hry (aj na mobile). Ukladá sa aj čas uloženia kvôli offline príjmu (§2.3).
- Formát JSON s poľom `save_version` (migrácie pri zmene formátu).
- 3 sloty.

### 10.4 Výkonnostné ciele
- 60 FPS na bežnom notebooku s integrovanou grafikou pri 50 mačkách na scéne.
- 60 FPS (min. 30) na strednom Android telefóne staršom ako 4 roky.
- Webová verzia < 30 MB pri prvom načítaní; mobilná aplikácia < 100 MB.

---

## 11. Rozsah MVP (vertikálny rez)

Cieľ: **15–20 minút hrania**, ktoré dokážu, že slučka je zábavná.

| Súčasť | Obsah MVP |
|---|---|
| Lokácia | Garáž (Fáza 1), 1 obrazovka |
| Mačky | 6 plemien, 6 farieb, 6 rysov, procedurálne mená |
| Diagnózy | 5: kliešte, zranená labka, infekcia uší, horúčka, špina |
| Minihry | 4 liečebné + 3 socializačné |
| Adoptéri | 8 archetypov s variáciami |
| Systémy | Otvorený režim s hodinami pre atmosféru, hlásenia a adoptéri v reálnom čase, offline príjem, stálice a dary, ekonomika (€, ★), adopčná zhoda, pohľadnice, album, výzvy, ukladanie |
| Naratív | Tutoriál so Zuzkou, prvé 3 skriptované hlásenia |
| Audio | 3 skladby, ~20 SFX |
| Jazyky | SK + EN |

**Mimo MVP:** stavba miestností, personál, udalosti, Fázy 2–4, mobil.

---

## 12. Riziká

| Riziko | Dopad | Zmiernenie |
|---|---|---|
| Výkon WebView na slabých Androidoch | Seknutá hra | Atlasy textúr, obmedzenie počtu animovaných objektov, testovanie na lacnom telefóne od M1 |
| Free assety nesedia štýlovo | Hra vyzerá „poskladane" | Jedna paleta, primárne 1–2 hlavné balíky, prefarbovanie, vlastné úpravy |
| Licencia assetu neumožňuje komerčné použitie | Právny problém pri vydaní | Povinný zápis každého assetu do `ASSETS.md` pred commitom, preferovať CC0 |
| Minihry sa omrzia | Pokles retencie | Varianty, rastúca náročnosť, automatizácia personálom v neskorších fázach |
| Rozsah (scope creep) | Hra nikdy nevyjde | Prísne značky 🟢🟡🔵, nové nápady len do `docs/IDEAS.md` |
| Ťažká téma (týranie zvierat) | Negatívne vnímanie | Jemný tón, žiadne grafické zobrazenie, dôraz na záchranu |

---

## 12a. Balans (simulácia aktívneho hráča)
Bot v `tests/balance.sim.test.ts` hrá aktívne (každých 5 s urobí, čo sa dá, minihry na ★★, najlepší záujemca, šetrí na odomknutú budovu). Spustenie: `SIM=1 npx vitest run tests/balance.sim.test.ts --silent=false`. Skutočný hráč bude zhruba 1,5–2× pomalší.

| | bot (min) | | bot (min) |
|---|---|---|---|
| úroveň 2 – kaviareň | 6–13 → 9–21 | úroveň 6 | 104–128 |
| úroveň 3 | 24–33 | catio | 161–191 |
| úroveň 4 – útulok | 36–55 → 60–69 | hotel | 222–244 |
| úroveň 5 – personál | 66–85 | úroveň 7 | 185–196 |
| klinika | 100–121 | 2. poschodie, CT, bazén | 267–307 |
| | | edukačné centrum | 304–317 |

Úpravy v tomto kole: ★ na úrovne 5–7 zvýšené (220 / 450 / 800 – ★ predbiehali peniaze), lacnejšie neskoré budovy (klinika 1 200 €, miestnosti 1 500–3 000 €, catio 2 000 €, hotel 2 500 €, edukácia 3 000 €), silnejšia kaviareň (dar hosťa 4 € + 2 € za stálicu, dary stálic 0,8 €/min). Hlavné príjmy po 8 h: adopcie ~29 000 €, hotel ~30 000 €, kaviareň ~7 000 €, dary stálic ~3 000 €.

## 13. Metriky úspechu (pre testovanie)
- Testeri hrajú MVP bez vyzvania ďalej ako 15 minút.
- ≥ 70 % testerov si pamätá meno aspoň jednej mačky po hraní.
- Pohľadnica vyvolá pozitívnu reakciu (pozorovanie / dotazník).
- Žiadna minihra nemá priemerné hodnotenie „frustrujúce".

---

## 14. Slovník
| Pojem | Význam |
|---|---|
| Hlásenie | Karta s nájdenou mačkou, ktorú hráč môže prijať |
| Diagnóza | Zdravotný problém mačky, odhaľuje sa nástrojmi |
| Rys | Povahová vlastnosť mačky |
| Zhoda | Percento vhodnosti mačky pre adoptéra |
| Pohľadnica | Odmena po úspešnej adopcii – obrázok z nového domova |
| Stálica | Vyliečená mačka, ktorú si hráč nechal; býva v kútiku/kaviarni a prináša dary |
| Offline | Čas, keď je hra zatvorená – beží iba to dobré (§2.3) |
| Album | Kniha záchranárskych príbehov (kolekcia) |
| Fáza | Veľkostný stupeň útulku (1–4) |
