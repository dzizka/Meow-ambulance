# 🐾 Labková záchranka

Cozy manažmentová hra o záchrane mačiek. Zachráň vystrašenú mačku z ulice, vylieč ju, získaj jej dôveru, nájdi jej dokonalý domov – a z garáže postav národné centrum pre záchranu mačiek.

> Stav: **predprodukcia** – pozri [ROADMAP](docs/ROADMAP.md)

## Dokumentácia
| Dokument | Obsah |
|---|---|
| [docs/GDD.md](docs/GDD.md) | Game Design Document – jediný zdroj pravdy o dizajne |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Míľniky a úlohy |
| [docs/ASSETS.md](docs/ASSETS.md) | Zdroje free assetov, pravidlá licencií, evidencia |
| [docs/TECH.md](docs/TECH.md) | Technické konvencie (Godot, štruktúra, kód) |
| [docs/IDEAS.md](docs/IDEAS.md) | Odkladisko nápadov mimo rozsahu |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Git workflow, vetvy, commity |
| [CREDITS.md](CREDITS.md) | Autori použitých assetov a hudby |

## Technológie
- **Godot 4.x** (GDScript)
- Git + **Git LFS** pre obrázky a zvuk
- GitHub Issues + Projects na úlohy, GitHub Actions na buildy

## Spustenie
1. Nainštaluj [Godot 4](https://godotengine.org/download) (stabilná verzia, štandardná – nie .NET).
2. Nainštaluj [Git LFS](https://git-lfs.com) a spusti `git lfs install`.
3. `git clone <url>` → v Godote *Import* → vyber `game/project.godot`.

## Štruktúra
```
docs/        dizajn a plánovanie
game/        Godot projekt
  assets/    grafika, zvuk, fonty (Git LFS)
  data/      herné dáta v JSON (mačky, diagnózy, rysy…)
  scenes/    .tscn scény
  scripts/   GDScript
  i18n/      preklady (CSV)
.github/     šablóny issues, CI
```

## Licencia
- **Kód:** MIT (pozri [LICENSE](LICENSE))
- **Assety tretích strán:** podľa licencie každého assetu – pozri [CREDITS.md](CREDITS.md)
