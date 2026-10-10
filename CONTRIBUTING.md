# Ako prispievať

## Vetvy
- `main` – vždy spustiteľná hra. Priamy push je zakázaný (ochrana vetvy).
- Pracovné vetvy podľa typu:
  - `feature/<issue>-kratky-popis` – napr. `feature/12-minihra-klieste`
  - `fix/<issue>-popis`
  - `art/<popis>` – pridanie assetov
  - `docs/<popis>` – zmeny dokumentácie / GDD

## Commity
Formát [Conventional Commits](https://www.conventionalcommits.org/):
```
feat(minigames): pridaná minihra vyťahovania kliešťov
fix(save): oprava načítania prázdneho slotu
art(cats): mourovatá mačka – 3 vizuálne stavy
docs(gdd): upravený výpočet adopčnej zhody
balance(data): nižšia cena krmiva vo Fáze 1
```

## Pull Requesty
1. Každý PR odkazuje na Issue (`Closes #12`).
2. PR s novými assetmi **musí** obsahovať zápis v `docs/ASSETS.md` (a `CREDITS.md`, ak treba).
3. PR, ktorý mení dizajn, musí upraviť `docs/GDD.md`.
4. Hra sa musí spustiť bez chýb v Godote.

## Issues
- Štítky: `mvp`, `v1.0`, `later`, `design`, `code`, `art`, `audio`, `bug`, `balance`.
- Každé Issue patrí do míľnika z [ROADMAP](docs/ROADMAP.md).

## Veľké súbory
Obrázky, zvuky a fonty idú cez **Git LFS** (nastavené v `.gitattributes`). Pred prvým commitom: `git lfs install`.
