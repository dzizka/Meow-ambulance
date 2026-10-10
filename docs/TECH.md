# Technické konvencie

## Engine
- Godot 4.x, štandardná (nie .NET) verzia. Verzia sa zafixuje v `game/project.godot` a v tomto súbore pri M0.
- Renderer: *Compatibility* (najširšia podpora vrátane webu a slabších zariadení).
- Pixel-art nastavenie: základné rozlíšenie 640×360, `stretch/mode = viewport`, `stretch/scale_mode = integer`, filter textúr `Nearest`.

## Štruktúra `game/`
```
game/
  project.godot
  assets/
    _licenses/         texty licencií stiahnutých assetov
    sprites/cats/      mačky
    sprites/interior/  nábytok, steny, podlahy
    sprites/people/    adoptéri, personál
    ui/                ikony, panely
    postcards/         ilustrácie pohľadníc
    audio/music/
    audio/sfx/
    fonts/
  data/                JSON herné dáta (balansovanie bez kódu)
  scenes/
    main/              Main.tscn, World.tscn
    cats/              Cat.tscn
    ui/                HUD, CatCard, AdopterCard, Album, DaySummary
    minigames/         jedna scéna = jedna minihra
  scripts/
    autoload/          GameState, TimeManager, EventBus, SaveManager, AudioManager, CatRegistry
    data/              CatData, ConditionData, TraitData, AdopterData (Resource)
    systems/           CatGenerator, MatchCalculator, Economy
  i18n/                translations.csv
  tests/               testy (GUT)
```

## Konvencie kódu
- **Statické typovanie všade:** `var trust: int = 0`, `func adopt(cat: CatData) -> void:`
- Súbory a triedy: `PascalCase.gd` pre triedy (`class_name CatData`), `snake_case` pre premenné a funkcie.
- Signály v minulom čase: `cat_adopted`, `day_ended`.
- Žiadne „magické čísla" – balans patrí do `data/*.json`.
- Žiadny text v kóde – iba kľúče prekladu: `tr("CAT_TRAIT_SHY")`.
- Logika (dáta + pravidlá) oddelená od scén. Scéna zobrazuje, systém rozhoduje.

## Minihry – rozhranie
Každá minihra je scéna s koreňovým skriptom, ktorý dedí `Minigame`:
```gdscript
class_name Minigame extends Control
signal finished(stars: int)   # 1–3, nikdy 0 – liečba vždy uspeje
func setup(cat: CatData) -> void: pass
```

## Ukladanie
- `user://saves/slot_N.json`, pole `save_version`.
- Pri zmene formátu pridať migračnú funkciu v `SaveManager`, staré savy nesmú prestať fungovať.

## Testy
- [GUT](https://github.com/bitwes/Gut) pre logiku: generovanie mačky, výpočet zhody, ekonomika.
- Minihry a UI sa testujú ručne podľa checklistu v PR.
