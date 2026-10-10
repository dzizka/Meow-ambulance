# 🐾 Meow Ambulance (Labková záchranka)

Cozy manažmentová hra o záchrane mačiek pre PC a mobil. Zachráň vystrašenú mačku z ulice, vylieč ju, získaj jej dôveru, nájdi jej dokonalý domov – a z garáže postav národné centrum pre záchranu mačiek.

> Stav: **predprodukcia** – pozri [ROADMAP](docs/ROADMAP.md)

## Dokumentácia
| Dokument | Obsah |
|---|---|
| [docs/GDD.md](docs/GDD.md) | Game Design Document – jediný zdroj pravdy o dizajne |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Míľniky a úlohy |
| [docs/ASSETS.md](docs/ASSETS.md) | Vybrané free assety, pravidlá licencií, evidencia |
| [docs/TECH.md](docs/TECH.md) | Technické konvencie (TypeScript, Phaser, štruktúra) |
| [docs/IDEAS.md](docs/IDEAS.md) | Odkladisko nápadov mimo rozsahu |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Git workflow, vetvy, commity |
| [CREDITS.md](CREDITS.md) | Autori použitých assetov a hudby |

## Technológie
- **TypeScript + Phaser** (HTML5), build cez **Vite**
- PC cez **Tauri**, mobil (Android/iOS) cez **Capacitor**
- Git + **Git LFS** pre obrázky a zvuk
- GitHub Issues + Projects na úlohy, GitHub Actions na testy a nasadenie

## Spustenie (od míľnika M0)
1. Nainštaluj [Node.js LTS](https://nodejs.org) a [Git LFS](https://git-lfs.com) (`git lfs install`).
2. `git clone https://github.com/dzizka/Meow-ambulance.git && cd Meow-ambulance`
3. `npm install`
4. `npm run dev` → otvor zobrazenú adresu v prehliadači (na mobile cez rovnakú Wi-Fi sieť).

## Štruktúra
```
docs/        dizajn a plánovanie
public/      assety a herné dáta (JSON)
src/         zdrojový kód (core = logika, scenes = zobrazenie)
tests/       testy logiky
licenses/    texty licencií stiahnutých assetov
.github/     šablóny issues, CI
```

## Licencia
- **Kód:** MIT (pozri [LICENSE](LICENSE))
- **Assety tretích strán:** podľa licencie každého assetu – pozri [CREDITS.md](CREDITS.md). Nesmú sa z repozitára ďalej šíriť samostatne.
