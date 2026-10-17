---
name: tdd-workflow
description: Testami riadený vývoj hernej logiky v Meow Ambulance (src/core, dáta v public/data). Použi pri novej mechanike, oprave chyby alebo refaktoringu GameState a systémov – najprv test, potom kód.
---

# Testami riadený vývoj (Meow Ambulance)

Upravené podľa `tdd-workflow` z everything-claude-code pre Vitest a hru bez Phaseru v jadre.

## Kedy
- Nová mechanika v `src/core/` (GameState, `src/core/systems/*`).
- Oprava chyby – najprv test, ktorý chybu zopakuje.
- Refaktoring (napr. delenie `GameState.ts`) – testy musia prechádzať pred aj po.

UI (`src/ui`) a Phaser scény (`src/scenes`) sa unit testami nepokrývajú – tie over v prehliadači (Playwright, screenshoty). Logiku, ktorú UI potrebuje, presuň do `src/core`, aby sa dala testovať.

## Postup
1. **Opíš správanie** jednou vetou z pohľadu hráča a nájdi ho v `docs/GDD.md` (alebo ho tam doplň).
2. **Napíš test** do `tests/<oblasť>.test.ts` (po slovensky, `describe('… (GDD §x.y)')`).
   - Dáta: `loadTestData()` z `tests/loadData.ts`; prahy úrovní cez `levelRep(n)`, nie natvrdo.
   - Stav: `new GameState(data, seed)` – pevný seed, čas posúvaj `s.tick(ms)`.
   - Na rýchle nastavenie použi `dev*` metódy (`devGive`, `devOpenCafe`, `devOfferEvent`…).
   - Čísla ber z `data.balance…`, aby test prežil zmenu balansu.
   - Dátum: `GameState.today = () => new Date(…)` a v `afterEach` vráť pôvodný.
3. **Spusti ho a over, že zlyhá** (`npx vitest run tests/<súbor>`), a to zo správneho dôvodu.
4. **Napíš najmenší kód**, ktorý test splní. Hodnoty patria do `public/data/*.json`, nie do kódu.
5. **Spusti znova** – zelený. Potom celé `npm test`.
6. **Uprac** (názvy, duplicity, menšie funkcie; súbory pod ~800 riadkov – nové systémy do `src/core/systems/`).
7. **Ulož/načítaj**: ak pribudol stav, pridaj test, že sa uloží (`toSave` → `fromSave`) a že starý save bez neho funguje.

## Čo testovať
- hlavná cesta, hranice (prahy, prázdne zoznamy, max. kapacita), opakovanie (odmena sa nedá dostať dvakrát);
- determinizmus – rovnaký seed, rovnaký výsledok; nové volania `rng` iba tam, kde treba;
- spätná kompatibilita savu.

Na konci spusti skill `verification-loop`.
