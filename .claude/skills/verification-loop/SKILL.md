---
name: verification-loop
description: Kontrola kvality pred commitom alebo PR v Meow Ambulance – build, typy, lint, testy, simulácia balansu, kontrola tajomstiev a diffu. Použi po dokončení funkcie, väčšej zmene alebo refaktoringu a vždy pred vytvorením PR.
---

# Overovacia slučka (Meow Ambulance)

Upravené podľa `verification-loop` z everything-claude-code. Ak niektorá fáza zlyhá, najprv ju oprav, až potom pokračuj.

## 1. Build
```bash
npm run build 2>&1 | tail -20
```

## 2. Typy
```bash
npx tsc --noEmit -p . 2>&1 | head -30
```

## 3. Lint a formát
```bash
npm run lint 2>&1 | tail -20
npx prettier --check src tests vite.config.ts 2>&1 | tail -5
```
Dátové súbory v `public/data/*.json` majú formát `json.dumps(indent=2, ensure_ascii=False)` – nespúšťaj na ne Prettier (zbalil by polia a nafúkol diff). Dokumenty v `docs/` Prettier nikdy nevyžadoval.

## 4. Testy
```bash
npm test 2>&1 | grep -E "×|FAIL|Test Files|Tests "
```
Testy bežia s pevným dátumom mimo sezóny (`tests/setup.ts`) – nič nesmie závisieť od dnešného dňa.

Kontrola, či existujú všetky sprity, beží iba so stiahnutými assetmi. Na ňu dočasne prelinkuj `public/assets` na klon `Meow-ambulance-offline` (a potom vráť prázdny priečinok – inak git uvidí zmenu podmodulu).

## 5. Balans (ak sa menili čísla v `public/data` alebo ekonomika)
```bash
SIM=1 npx vitest run tests/balance.sim.test.ts --silent=false 2>&1 | tail -40
```
Porovnaj časy úrovní a stavieb s `main` (profily `adopter`, `keeper`, `SIM_PROFILE=...`).

## 6. Bezpečnosť a poriadok
```bash
git diff origin/main --stat
git diff origin/main | grep -nE "^\+.*(console\.log|debugger|sk-[A-Za-z0-9]|api[_-]?key|password|storePassword|keyPassword)" | head
git status --short | grep -E "public/assets|\.keystore|\.jks|\.env"
```
- Žiadny `console.log`/`debugger` v `src/`.
- Do verejného repozitára nesmie ísť nič z `public/assets` (súkromný podmodul – licencie assetov), podpisové kľúče ani heslá.

## 7. Diff a projektové pravidlá
Prečítaj celý diff a skontroluj:
- všetky texty cez `t()` a kľúče v `src/i18n/sk.json` **aj** `en.json`;
- zmena dizajnu alebo balansu je zapísaná v `docs/GDD.md`;
- starý save sa načíta (nové polia savu sú voliteľné alebo majú migráciu);
- herná logika ostáva v `src/core/` bez Phaseru;
- UI zmena vyskúšaná v prehliadači (Playwright, šírka telefónu ~420 px) – na telefóne ju musí overiť človek, netvrď to.

## Výstup
```
OVERENIE
Build:   OK / ZLYHAL
Typy:    OK / n chýb
Lint:    OK / n
Testy:   OK (x/y) / zlyhali: …
Balans:  bez zmeny / zmena: …
Tajomstvá a assety: OK / …
Diff:    n súborov
Pripravené na PR: ÁNO / NIE – čo opraviť: …
```
