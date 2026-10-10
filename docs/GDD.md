# Labková záchranka – Game Design Document (GDD)

> **Pracovný názov:** Labková záchranka (EN: *Paw Rescue*)
> **Žáner:** Cozy manažment / simulácia útulku a veterinárnej kliniky
> **Technológia:** TypeScript + Phaser (HTML5), Vite
> **Platformy:** Web (demo) · PC cez Tauri (Windows / macOS / Linux, Steam) · Mobil cez Capacitor (Android / iOS)
> **Verzia dokumentu:** 0.1 (živý dokument – každá zmena ide cez Pull Request)

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
| **4. Rast bez stresu** | Žiadne smrti mačiek, žiadny game over. Tlak existuje (udalosti, kapacita), ale vždy je cesta von. |
| **5. Emocionálna odmena** | Pohľadnice z nového domova, album príbehov – dôvod vrátiť sa zajtra. |

### 1.3 Cieľová skupina
- **Primárna:** milovníci mačiek a cozy hier, 16–40 rokov, hrajú Stardew Valley, Cats & Soup, Unpacking, Cat Cafe Manager.
- **Sekundárna:** fanúšikovia manažmentových hier (Two Point Hospital, Theme Hospital), ktorí chcú pokojnejší zážitok.
- **Dĺžka sedenia:** 15–45 minút (PC), 3–10 minút (mobil).

### 1.4 Inšpirácie a čo si z nich berieme
| Hra | Čo berieme |
|---|---|
| Two Point Hospital | Stavba miestností, diagnostika → liečba, najímanie personálu, humor |
| Stardew Valley | Rytmus dňa, vzťahy, pocit „ešte jeden deň" |
| Cats & Soup | Idle pohoda, roztomilé animácie, zberateľstvo |
| Good Pizza, Great Pizza | Zákazníci s požiadavkami (→ adoptéri), čitateľné postavy |
| Pokémon (Pokédex) | Album na zbieranie plemien a variácií |

### 1.5 Čo hra NIE JE
- Nie je to realistický veterinárny simulátor (žiadna krv, žiadna eutanázia, žiadne smrti).
- Nie je to free-to-play s energiou a čakaním (aspoň nie v PC verzii).
- Nie je to hra o rýchlosti a reflexoch.

---

## 2. Herná slučka

### 2.1 Makro slučka (session → týždne)
```
Zachráň mačky → Vylieč a socializuj → Adoptuj do správnych rúk
       ↑                                         ↓
Rozšír útulok  ←  Peniaze + Reputácia + Pohľadnice + Album
```

### 2.2 Štruktúra herného dňa 🟢 MVP
Jeden herný deň trvá **cca 6–8 minút reálneho času** (nastaviteľné). Hra beží v reálnom čase s možnosťou pauzy a zrýchlenia (1×, 2×, 3×).

| Čas v hre | Fáza | Čo hráč robí |
|---|---|---|
| 07:00 | **Ranné hlásenia** | Na tabuli/telefóne prídu 1–3 hlásenia o nájdených mačkách. Hráč rozhodne, ktoré prijme (obmedzené kapacitou). |
| 08:00–17:00 | **Starostlivosť** | Diagnostika, liečba, kŕmenie, socializácia. Adoptéri prichádzajú počas otváracích hodín. |
| 17:00–19:00 | **Adopcie a návštevy** | Hlavný čas adopčných pohovorov, mačacia herňa pre verejnosť. |
| 20:00 | **Súhrn dňa** | Prehľad: zarobené, adoptované, zlepšené mačky, nové pohľadnice. Rozhodnutia o stavbe. |

> **Pravidlo pohody:** ak hráč niečo nestihne, nič zlé sa nestane hneď. Potreby mačky klesajú pomaly a starosť preberú dobrovoľníci (menej efektívne).

---

## 3. Fáza 1 – Záchrana a príjem (Rescue)

### 3.1 Hlásenia 🟢 MVP
Každé hlásenie je karta s:
- **Miesto a situácia** – „Mačiatko v krabici pred obchodom", „Zranená divá mačka na stavbe"
- **Odhad náročnosti** – 1 až 3 labky
- **Čas vypršania** – hlásenie zmizne po X hodinách (mačku zachráni niekto iný – žiadny trest, len ušlá príležitosť)

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

---

## 4. Fáza 2 – Liečba a rehabilitácia (Care)

### 4.1 Diagnostika 🟢 MVP
Diagnózy sú pri príchode **skryté** (zobrazené ako „?"). Hráč ich odhaľuje nástrojmi:

| Nástroj | Odhaľuje | Dostupné od |
|---|---|---|
| Ruka (prehliadka) | Viditeľné: kliešte, zranenie, špina | Fáza 1 |
| Teplomer | Horúčka / infekcia | Fáza 1 |
| Stetoskop | Srdce, pľúca (minihra: ťuknúť v rytme) | Fáza 1 |
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
| **Kúpanie** | Penenie, splachovanie, sušenie uterákom | 🟡 v1.0 |
| **Očkovanie** | Nájdi správne miesto, odvráť pozornosť maškrtou | 🟡 v1.0 |
| **Strihanie pazúrikov** | Strihaj len špičku (nie ružovú časť) | 🟡 v1.0 |
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

### 4.4 Povahové rysy 🟢 MVP (6 rysov), 🟡 v1.0 (15+)
| Rys | Účinok na hru | Účinok na adopciu |
|---|---|---|
| Plachá | Pomalšia dôvera, potrebuje tichú miestnosť | Pokojná domácnosť, bez detí |
| Maznavá | Rýchla dôvera, smutní v samote | Niekto, kto je veľa doma |
| Divoká | Syčí pri liečbe (ťažšie minihry) | Dom so záhradou, skúsený majiteľ |
| Maškrtná | Jedlo dáva bonus, priberá | Takmer kdekoľvek |
| Hravá | Rýchlo sa nudí, potrebuje hračky | Aktívna rodina, deti |
| Leňoch | Pomalá rehabilitácia, ale spokojná | Seniori, byt |
| *v1.0:* Bojí sa vysávača, Kamarátska (lepšie v skupine), Zvedavá (uteká z klietky), Hlasná, Teritoriálna… | | |

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
| **Pohľadnica** 🟢 MVP | Po 2–5 herných dňoch príde ilustrovaná pohľadnica: mačka v novom domove + krátky odkaz od majiteľa. Ukladá sa do albumu. |
| **Zápis do albumu** | Odomknutie plemena/farby/príbehu |

---

## 6. Fáza 4 – Rozširovanie (Progression)

### 6.1 Ekonomika 🟢 MVP
| Mena | Ako ju získať | Na čo ju míňať |
|---|---|---|
| **Peniaze (€)** | Adopcie, dary návštevníkov herne, granty, predaj v kaviarni | Vybavenie, miestnosti, krmivo, personál, lieky |
| **Reputácia (⭐)** | Dobré adopcie, vyriešené udalosti, spokojní návštevníci | Odomykanie fáz, grantov a typov hlásení (nemíňa sa – je to úroveň) |
| **Srdiečka (❤️)** 🟡 v1.0 | Pohľadnice, album, výzvy | Kozmetika: dekorácie, oblečenie pre personál, farby stien |

**Prevádzkové náklady:** krmivo a lieky na mačku/deň + mzdy personálu. Ak dôjdu peniaze → prídu dobrovoľníci a núdzová zbierka (žiadny bankrot).

### 6.2 Fázy rastu útulku
| Fáza | Názov | Podmienka odomknutia | Kapacita | Nové prvky |
|---|---|---|---|---|
| **1** 🟢 | Garážová záchranka | štart | 2 klietky → max 4 | Stôl, misky, teplomer, ruka, stetoskop. Pomocníčka: dobrovoľníčka **Zuzka** (tutoriál). |
| **2** 🟡 | Komunitný útulok | 10 adopcií, ⭐ 100 | 8–12 | Prenajatý domček: karanténa, mačacia herňa pre verejnosť (príjem z darov), ambulancia na očkovanie, otoskop |
| **3** 🟡 | Špecializovaná klinika | 40 adopcií, ⭐ 500 | 20–30 | Personál (veterinár, ošetrovateľ, správca sociálnych sietí), laboratórium, röntgen, operačná sála, catio (vonkajší výbeh) |
| **4** 🔵 | Národné centrum felíd | 120 adopcií, ⭐ 2000 | 50+ | Viac poschodí, CT, rehabilitačný bazén, mačací hotel, edukačné centrum (školské výlety) |

> **MVP obsahuje iba Fázu 1** a „okno" do Fázy 2 (zamknutá budova, ktorú hráč vidí na mape – motivácia).

### 6.3 Stavba a umiestňovanie 🟡 v1.0
- Mriežkový systém (grid), miestnosti sa kreslia ťahaním (ako v Two Point Hospital).
- Každá miestnosť má povinné predmety (napr. ambulancia = stôl + skrinka s liekmi).
- Dekorácie zvyšujú **Spokojnosť** mačiek v miestnosti a atraktivitu pre návštevníkov.

### 6.4 Personál 🟡 v1.0 (Fáza 3+)
| Rola | Automatizuje | Úroveň zručnosti zlepšuje |
|---|---|---|
| Dobrovoľník | Kŕmenie, upratovanie | – (zadarmo, ale pomalý) |
| Ošetrovateľ | Socializácia, kúpanie | Rýchlosť, šanca na ✨ |
| Veterinár | Diagnostika a jednoduchá liečba | Zložité diagnózy |
| Správca sociálnych sietí | Priláka viac adoptérov | Kvalita adoptérov |
| Recepčný | Spracovanie hlásení | Viac hlásení naraz |

> Kľúčové pravidlo: **automatizácia nikdy nezoberie hráčovi zábavné časti**. Personál robí rutinu, hráč môže vždy zasiahnuť sám (a dostať lepší výsledok).

---

## 7. Retenčné mechaniky

### 7.1 Kniha záchranárskych príbehov (Album) 🟢 MVP
- Mriežka slotov: **plemená × farby/vzory** + špeciálne strany (vzácne diagnózy, udalosti, seniori).
- Každá adoptovaná mačka = stránka: portrét pred/po, meno, povaha, príbeh, pohľadnice.
- Percentá dokončenia a odmeny za dokončené strany (dekorácie, nové typy hlásení).
- MVP: 6 plemien × 6 farieb = 36 slotov.

### 7.2 Vzácne mačky 🟡 v1.0
- Vzácne farby (napr. dymová, čokoládová), heterochrómia, polydaktylia („palčiaky"), bezsrsté, trojfarebný kocúr (ultra vzácny).
- Šanca na výskyt rastie s reputáciou a vybavením.

### 7.3 Udalosti a výzvy 🟡 v1.0
| Udalosť | Trvanie | Mechanika | Odmena |
|---|---|---|---|
| **Zima prichádza** | 5 dní | 2× viac hlásení, mačky prichádzajú podchladené (nová diagnóza), treba vyhrievané pelechy | Zimné dekorácie, album strana |
| **Záchrana z množiarne** | 3 dni | 15 mačiatok naraz, dočasné klietky, pomoc susedov | Veľký grant, ⭐ |
| **Mačací deň otvorených dverí** | 1 deň | 3× viac návštevníkov a adoptérov | Peniaze, ⭐ |
| **Povodne** | 4 dni | Mokré, vystrašené mačky, núdzová kapacita | Unikátne pohľadnice |
| **Sezónne** (Vianoce, Halloween…) 🔵 | týždeň | Kozmetika, tematické mačky | Dekorácie |

### 7.4 Vizuálna spätná väzba 🟢 MVP
Každá mačka má **3 vizuálne stavy** (pre MVP stačí kombinácia sprite + overlay):
1. **Príchod:** špinavý overlay, sklopené uši, chvost pod sebou, schovávanie v rohu klietky
2. **Zotavovanie:** čistá, obväzy, sedí pri mreži, zvedavá
3. **Pripravená:** lesklý efekt (particle ✨), pradenie (zvuk + vibrácia sprite), hrá sa, spí na chrbte

Pri prechode stavu: krátka „premena" s efektom a zvukom (dopamínový moment).

### 7.5 Ďalšie háčiky
- 🟡 **Denné maličkosti:** ranná maškrta pre všetky mačky (bonus spokojnosti), denné „mačacie prekvapenie" (mačka spí na nečakanom mieste).
- 🟡 **Fotografický režim:** odfoť mačky v herni, ulož do albumu.
- 🔵 **Návštevy adoptovaných mačiek:** občas sa bývalý majiteľ zastaví s mačkou na kontrolu.

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
- **Hudba:** pokojný lo-fi / akustický soundtrack, 3–5 skladieb v MVP (deň, noc, minihra, udalosť, menu).
- **SFX:** pradenie (kľúčový zvuk!), mňaukanie (rôzne podľa nálady), syčanie, kroky, UI kliky, „premena" jingle.
- Všetky zdroje a licencie → `docs/ASSETS.md` a `CREDITS.md`.

### 9.3 UI/UX zásady
- Ovládanie **jednou rukou / myšou** – pripravené na mobil.
- Karta mačky dostupná jedným klikom: štatistiky, odhalené rysy, diagnózy, príbeh.
- Farebné kódovanie potrieb (ikonky nad hlavou mačky).
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
  core/        (čistá logika – bez Phaseru, testovateľná)
    GameState      – peniaze, reputácia, deň, fáza útulku
    TimeManager    – herný čas, pauza, zrýchlenie, udalosti dayStarted/dayEnded
    CatRegistry    – všetky mačky v útulku (dáta)
    EventBus       – typované globálne udalosti (catAdmitted, catAdopted, postcardArrived…)
    SaveManager    – ukladanie/načítanie (JSON, verzovaný formát)
    systems/       – CatGenerator, MatchCalculator, Economy
  data/        typy: CatData, ConditionData, TraitData, AdopterData, RoomData
  scenes/      (Phaser scény – iba zobrazenie a vstup)
    BootScene, PreloadScene, WorldScene (útulok), UIScene (HUD, karty),
    minigames/ (jedna scéna = jedna minihra), AlbumScene, DaySummaryScene
  audio/       AudioManager
  i18n/        sk.json, en.json
```
**Zásada:** všetka herná logika žije v `src/core/` a nezávisí od Phaseru. Phaser scény iba zobrazujú stav a posielajú akcie hráča. Vďaka tomu sa logika dá testovať, ukladať a v prípade potreby preniesť inam bez prepisovania.

### 10.3 Ukladanie hry 🟢 MVP
- Automatické uloženie na konci každého dňa + manuálne v menu.
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
| Systémy | Herný deň, ekonomika (€, ⭐), adopčná zhoda, pohľadnice, album, ukladanie |
| Naratív | Tutoriál so Zuzkou, prvé 3 dni so skriptovanými hláseniami |
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
| Album | Kniha záchranárskych príbehov (kolekcia) |
| Fáza | Veľkostný stupeň útulku (1–4) |
