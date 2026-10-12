/* global console */
/**
 * Hráčska wiki (príručka) – vygeneruje sa z herných dát po `vite build`, takže je vždy aktuálna.
 * Výstup: dist/wiki/index.html (slovensky) a dist/wiki/en/index.html (anglicky).
 * Spustenie: node scripts/build-wiki.mjs  (volá ho `npm run build`)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const data = {
  balance: json('public/data/balance.json'),
  breeds: json('public/data/breeds.json'),
  conditions: json('public/data/conditions.json').conditions,
  traits: json('public/data/traits.json').traits,
  adopters: json('public/data/adopters.json').adopters,
  equipment: json('public/data/equipment.json').equipment,
  decor: json('public/data/decor.json').decor,
  staff: json('public/data/staff.json').staff,
  challenges: json('public/data/challenges.json').challenges,
  achievements: json('public/data/achievements.json').achievements,
  events: json('public/data/events.json').events,
  reports: json('public/data/reports.json').reports,
  cosmetics: json('public/data/cosmetics.json'),
};
const DICTS = { sk: json('src/i18n/sk.json'), en: json('src/i18n/en.json') };
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );

/** Texty, ktoré v hre nie sú (úvod, tipy) – v oboch jazykoch. */
const TEXT = {
  sk: {
    title: 'Meow Ambulance – príručka hráča',
    lead: 'Všetko o hre na jednom mieste: mačky, liečba, adopcie, budovy, obchod a tipy. Údaje sú priamo z hry, preto vždy platia.',
    play: '▶ Hrať hru',
    search: 'Hľadať v príručke…',
    other: 'English',
    toc: 'Obsah',
    s: {
      start: 'Ako hrať',
      cats: 'Mačky',
      care: 'Diagnostika a liečba',
      social: 'Opatera a povaha',
      adopt: 'Adopcie',
      levels: 'Úrovne a budovy',
      shop: 'Obchod',
      staff: 'Personál',
      cafe: 'Kaviareň, hotel, výbeh, edukácia',
      goals: 'Výzvy, úspechy, udalosti',
      city: 'Kastračné kampane',
      hearts: 'Srdiečka',
      tips: 'Tipy a otázky',
    },
    loop: [
      '<b>Hlásenie</b> 📋 – niekde čaká mačka. Prijmi ho, ak máš voľnú klietku.',
      '<b>Vyšetrenie</b> 🔍 – nástrojmi (ruka, teplomer, stetoskop, otoskop, neskôr krvný test, röntgen, CT) odhalíš skryté diagnózy. Každé vyšetrenie je krátka minihra.',
      '<b>Liečba</b> 💊 – každá diagnóza má minihru, hodnotí sa 1–3 ★ (vyliečiš vždy, hviezdičky dajú viac zdravia).',
      '<b>Opatera</b> ❤️ – kŕm, česaj, hraj sa; dôvera rastie podľa povahy mačky.',
      '<b>Adopcia</b> 🚪 – keď je mačka zdravá a dôverčivá, príde záujemca. Čím lepšia zhoda s jeho domovom, tým väčší príspevok, viac ★ a pohľadnica z nového domova. Čistá a spokojná mačka ✨ (lesk) urobí lepší dojem. Pri slabej zhode sa mačka o pár minút vráti – smutnejšia a s nižšou dôverou.',
      '<b>Rast</b> ★ – hviezdičky zvyšujú úroveň útulku a odomykajú budovy, vybavenie a personál.',
    ],
    tips: [
      [
        'Hra sa ukladá sama',
        'Každých 15 s a pri zatvorení. Keď je hra zavretá, beží iba to dobré: dary stálic, nové hlásenia a pohľadnice.',
      ],
      [
        'Ako zistím povahu mačky?',
        'Skúšaj aktivity v Opatere. Nevhodná aktivita (💢) aj obľúbená (✨) prezradí povahu. V karte „O mačke → Čo má rada“ je zapísané, ako reagovala.',
      ],
      [
        'Čo s mačkou, ktorú nikto nechce?',
        'Nechaj si ju ako stálicu. Stálice dávajú pravidelné dary, chodia za nimi hostia do kaviarne a majú želania.',
      ],
      [
        'Nestíham všetko',
        'Najmi personál (od úrovne 5) – robí rutinu, ty sa venuješ minihrám. Ťukni na postavičku a povie ti, čo sa deje.',
      ],
      [
        'Na čo sú srdiečka?',
        'Deň adopcií, želania stálic a farby stien. Dostaneš ich za pohľadnice, album, úspechy, udalosti a kampane.',
      ],
      [
        'Peniaze mi prebývajú',
        'Kastračné kampane v záložke Mesto sú nekonečné – a keď sú drahé, začni nový program a získaj 🏅.',
      ],
      [
        'Ovládanie',
        'Všetko sa ovláda jedným prstom alebo myšou. Na PC funguje Escape ako Späť, na Androide systémové tlačidlo Späť.',
      ],
    ],
  },
  en: {
    title: 'Meow Ambulance – player guide',
    lead: 'Everything about the game in one place: cats, treatment, adoptions, buildings, shop and tips. The numbers come straight from the game data.',
    play: '▶ Play the game',
    search: 'Search the guide…',
    other: 'Slovenčina',
    toc: 'Contents',
    s: {
      start: 'How to play',
      cats: 'Cats',
      care: 'Diagnosis and treatment',
      social: 'Care and personality',
      adopt: 'Adoptions',
      levels: 'Levels and buildings',
      shop: 'Shop',
      staff: 'Staff',
      cafe: 'Café, hotel, catio, education',
      goals: 'Challenges, achievements, events',
      city: 'Neutering campaigns',
      hearts: 'Hearts',
      tips: 'Tips and FAQ',
    },
    loop: [
      '<b>Report</b> 📋 – a cat needs help somewhere. Accept it if you have a free cage.',
      '<b>Examination</b> 🔍 – tools (hand, thermometer, stethoscope, otoscope, later blood test, X-ray, CT) reveal hidden conditions. Each exam is a short minigame.',
      '<b>Treatment</b> 💊 – every condition has a minigame rated 1–3 ★ (you always cure it; stars give more health).',
      '<b>Care</b> ❤️ – feed, brush, play; trust grows depending on the cat’s personality.',
      '<b>Adoption</b> 🚪 – when a cat is healthy and trusting, an adopter arrives. The better the match with their home, the bigger the fee, more ★ and a postcard from the new home. A clean, content cat ✨ (glow) makes a better impression. After a weak match the cat comes back a few minutes later, sadder and less trusting.',
      '<b>Growth</b> ★ – stars raise your shelter level and unlock buildings, equipment and staff.',
    ],
    tips: [
      [
        'The game saves itself',
        'Every 15 s and when closed. While closed only good things happen: resident donations, new reports and postcards.',
      ],
      [
        'How do I learn a cat’s personality?',
        'Try activities in the Care tab. Both a disliked (💢) and a loved (✨) activity reveal it. “About → Likes” lists how the cat reacted.',
      ],
      [
        'Nobody wants this cat',
        'Keep it as a resident. Residents donate regularly, café guests come to see them and they have wishes.',
      ],
      [
        'I can’t keep up',
        'Hire staff (from level 5) – they do the routine, you play the minigames. Tap a character to hear what’s going on.',
      ],
      [
        'What are hearts for?',
        'Adoption Day, resident wishes and wall colours. You earn them from postcards, the album, achievements, events and campaigns.',
      ],
      [
        'I have too much money',
        'Neutering campaigns in the Town tab never end – and when they get expensive, start a new programme for 🏅.',
      ],
      [
        'Controls',
        'Everything works with one finger or a mouse. Escape works as Back on PC, the system Back button on Android.',
      ],
    ],
  },
};

function build(lang) {
  const d = DICTS[lang];
  const T = TEXT[lang];
  const t = (k, vars = {}) =>
    (d[k] ?? DICTS.sk[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => String(vars[n] ?? `{${n}}`));
  const b = data.balance;
  const assets = lang === 'sk' ? '../assets' : '../../assets';
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
  const table = (head, rows) =>
    `<div class="tw"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
      .join('')}</tbody></table></div>`;
  const catImg = (sheet) =>
    `<span class="cat" style="background-image:url(${assets}/sprites/cats/popshop/${sheet}.png)"></span>`;
  const sections = [];
  const sec = (id, html) => sections.push({ id, title: T.s[id], html });

  // --- Ako hrať
  sec(
    'start',
    `<ol class="loop">${T.loop.map((x) => `<li>${x}</li>`).join('')}</ol>
     <p>${lang === 'sk' ? 'Hlavné menu, pauza (⏸) a nastavenia zvuku a jazyka sú hore vpravo. Menu ☰ obsahuje výzvy, úspechy, album, poštu, mesto a obchod.' : 'Main menu, pause (⏸) and sound/language settings are top right. The ☰ menu holds challenges, achievements, album, mail, town and shop.'}</p>`,
  );

  // --- Mačky
  const coatSprite = Object.fromEntries(data.breeds.coats.map((c) => [c.id, c.sprites[0]]));
  const regular = data.breeds.coats.filter((c) => !c.special);
  const albumSize = data.breeds.breeds.reduce((n, br) => n + (br.coat ? 1 : regular.length), 0);
  sec(
    'cats',
    `<h3>${lang === 'sk' ? 'Plemená' : 'Breeds'} (${data.breeds.breeds.length})</h3>
     <p>${lang === 'sk' ? `Vzácnejšie plemeno = vyšší príspevok pri adopcii (+15 % za stupeň). Niektoré plemená majú vždy rovnakú farbu. Album má ${albumSize} políčok (plemeno × farba).` : `A rarer breed means a higher adoption fee (+15 % per level). Some breeds always have the same colour. The album has ${albumSize} slots (breed × colour).`}</p>
     ${table(
       [
         lang === 'sk' ? 'Plemeno' : 'Breed',
         lang === 'sk' ? 'Vzácnosť' : 'Rarity',
         lang === 'sk' ? 'Farba' : 'Colour',
         lang === 'sk' ? 'Srsť' : 'Coat',
       ],
       [...data.breeds.breeds]
         .sort((a, c) => a.rarity - c.rarity)
         .map((br) => [
           (br.coat ? catImg(coatSprite[br.coat]) : '') + esc(t(br.name_key)),
           `<span class="st">${stars(br.rarity)}</span>`,
           br.coat
             ? esc(t(`COAT_${br.coat.toUpperCase()}`))
             : lang === 'sk'
               ? 'akákoľvek bežná'
               : 'any regular',
           br.coat_care === 'long'
             ? lang === 'sk'
               ? 'dlhá – treba česať'
               : 'long – needs brushing'
             : br.coat_care === 'none'
               ? lang === 'sk'
                 ? 'bez srsti'
                 : 'hairless'
               : lang === 'sk'
                 ? 'krátka'
                 : 'short',
         ]),
     )}
     <h3>${lang === 'sk' ? 'Farby srsti' : 'Coat colours'} (${data.breeds.coats.length})</h3>
     <div class="coats">${data.breeds.coats
       .map(
         (c) =>
           `<div class="coat">${catImg(c.sprites[0])}<span>${esc(t(c.name_key))}<br><small class="st">${stars(c.rarity)}</small></span></div>`,
       )
       .join('')}</div>
     <h3>${lang === 'sk' ? 'Vzácne znaky' : 'Rare marks'}</h3>
     <ul>${['hetero', 'poly', 'tortie_male'].map((k) => `<li>✨ <b>${esc(t(`RARE_${k.toUpperCase()}`))}</b></li>`).join('')}</ul>
     <p>${lang === 'sk' ? `Vzácna mačka má vyšší príspevok (+${Math.round((b.rare?.fee_bonus ?? 0) * 100)} %), viac ★ a zapíše sa do zvláštneho riadku albumu (+5 ❤).` : `A rare cat has a higher fee (+${Math.round((b.rare?.fee_bonus ?? 0) * 100)} %), more ★ and gets its own album row (+5 ❤).`}</p>
     <h3>${lang === 'sk' ? 'Odkiaľ mačky prichádzajú (hlásenia)' : 'Where cats come from (reports)'}</h3>
     <ul>${data.reports.map((r) => `<li>${esc(t(r.name_key))}${r.age ? ` – <i>${esc(t(`AGE_${r.age.toUpperCase()}`))}</i>` : ''}</li>`).join('')}</ul>`,
  );

  // --- Liečba
  const toolName = (tool) => t(`UI_TOOL_${tool.toUpperCase()}`);
  sec(
    'care',
    `<p>${lang === 'sk' ? 'Diagnózy sú skryté (?). Odhalíš ich nástrojom – každý nástroj je krátka minihra, ktorá ukáže nález. Liečba je minihra s hodnotením 1–3 ★; vyliečiš vždy.' : 'Conditions are hidden (?). A tool reveals them – each tool is a short minigame that shows the finding. Treatment is a minigame rated 1–3 ★; you always cure it.'}</p>
     ${table(
       [
         lang === 'sk' ? 'Diagnóza' : 'Condition',
         lang === 'sk' ? 'Odhalí' : 'Revealed by',
         lang === 'sk' ? 'Liečba' : 'Treatment',
         lang === 'sk' ? 'Poznámka' : 'Note',
       ],
       data.conditions.map((c) => [
         esc(t(c.name_key)),
         esc(toolName(c.reveal_tool)),
         esc(c.minigame.replace(/_/g, ' ')),
         [
           c.clinic ? (lang === 'sk' ? 'klinika' : 'clinic') : '',
           c.ages ? c.ages.map((a) => t(`AGE_${a.toUpperCase()}`)).join(', ') : '',
           c.event
             ? `${lang === 'sk' ? 'udalosť' : 'event'}: ${t(`EVENT_${c.event.toUpperCase()}`)}`
             : '',
           c.minigame === 'surgery' ? (lang === 'sk' ? 'operačná sála' : 'operating room') : '',
           c.minigame === 'swim' ? (lang === 'sk' ? 'bazén' : 'pool') : '',
         ]
           .filter(Boolean)
           .join(' · '),
       ]),
     )}
     <p>${lang === 'sk' ? 'Útulok: očkovanie zdravej mačky (+25 % príspevok, +★). Klinika: kastrácia dospelej mačky, rehabilitácia po zlomenine v bazéne – vyšší príspevok.' : 'Shelter: vaccinating a healthy cat (+25 % fee, +★). Clinic: neutering adult cats, rehab after a fracture in the pool – higher fee.'}</p>`,
  );

  // --- Opatera a povaha
  const acts = ['feather', 'brush', 'hand_feed', 'sit_quietly'];
  const actName = {
    feather: 'ACT_FEATHER',
    brush: 'ACT_BRUSH',
    hand_feed: 'ACT_HAND_FEED',
    sit_quietly: 'ACT_SIT_QUIETLY',
  };
  const mult = (m) =>
    m > 1.05
      ? `<span class="good">✨ ×${m}</span>`
      : m < 0.95
        ? `<span class="bad">💢 ×${m}</span>`
        : `×${m}`;
  sec(
    'social',
    `<p>${lang === 'sk' ? 'Dôvera rastie socializáciou. Každá povaha má rada niečo iné – tabuľka ukazuje, koľkokrát viac (✨) alebo menej (💢) dôvery aktivita prinesie. Kŕmenie je vždy zadarmo, iba s prestávkou.' : 'Trust grows through care. Each personality likes something else – the table shows how much more (✨) or less (💢) trust an activity gives. Feeding is always free, with a cooldown.'}</p>
     ${table(
       [
         lang === 'sk' ? 'Povaha' : 'Personality',
         ...acts.map((a) => esc(t(actName[a]))),
         lang === 'sk' ? 'Hodí sa k' : 'Good with',
       ],
       data.traits.map((tr) => [
         `<b>${esc(t(tr.name_key))}</b>`,
         ...acts.map((a) => mult(tr.social[a] ?? 1)),
         esc((tr.adopt_good ?? []).map((g) => t(`TAG_${g}`)).join(', ')),
       ]),
     )}`,
  );

  // --- Adopcie
  const m = b.match;
  sec(
    'adopt',
    `<p>${lang === 'sk' ? `Mačka je pripravená na adopciu, keď má zdravie aj dôveru dosť vysoko. Zhoda ≥ ${m.perfect} % je výborná (plná odmena, zaručená pohľadnica), ≥ ${m.good} % dobrá (pohľadnica s 50 % šancou).` : `A cat is ready when both health and trust are high enough. A match ≥ ${m.perfect} % is perfect (full reward, guaranteed postcard), ≥ ${m.good} % good (50 % postcard chance).`}</p>
     ${table(
       [
         lang === 'sk' ? 'Záujemca' : 'Adopter',
         lang === 'sk' ? 'Domov' : 'Home',
         lang === 'sk' ? 'Nechce' : 'Won’t take',
       ],
       data.adopters.map((a) => [
         `<b>${esc(t(a.name_key))}</b><br><small>${esc(t(a.desc_key))}</small>`,
         esc(a.tags.map((g) => t(`TAG_${g}`)).join(', ')),
         esc(
           (a.dealbreakers ?? [])
             .map((x) =>
               x === 'senior_cat'
                 ? t('AGE_SENIOR')
                 : d[`AGE_${x.toUpperCase()}`]
                   ? t(`AGE_${x.toUpperCase()}`)
                   : t(`TRAIT_${x.toUpperCase()}`),
             )
             .join(', ') || '–',
         ),
       ]),
     )}`,
  );

  // --- Úrovne
  sec(
    'levels',
    `${table(
      [lang === 'sk' ? 'Úroveň' : 'Level', '★', lang === 'sk' ? 'Odomkne' : 'Unlocks'],
      b.levels.map((l, i) => [
        `${i + 1}. ${esc(t(l.name_key))}`,
        l.rep,
        esc(l.unlocks.map((u) => t(`UNLOCK_${u.toUpperCase()}`)).join(', ') || '–'),
      ]),
    )}
    <ul>
      <li>☕ ${esc(t('UI_ROOM_CAFE'))} – ${b.cafe.price} €</li>
      <li>🏠 ${esc(t('UI_ROOM_SHELTER'))} – ${b.shelter.price} €</li>
      <li>🩺 ${esc(t('UI_ROOM_CLINIC'))} – ${b.clinic.price} € ${lang === 'sk' ? '+ miestnosti (laboratórium, röntgen, operačná sála)' : '+ rooms (lab, X-ray, operating room)'}</li>
      <li>🌿 ${esc(t('UI_ROOM_CATIO'))} – ${b.catio.price} €</li>
      <li>🏨 ${esc(t('UI_ROOM_HOTEL'))} – ${b.hotel.price} €</li>
      <li>🎓 ${esc(t('UI_ROOM_EDUCATION'))} – ${b.education.price} €</li>
    </ul>`,
  );

  // --- Obchod
  const rooms = ['garage', 'cafe', 'clinic', 'hotel'];
  const roomName = {
    garage: 'UI_ROOM_GARAGE',
    cafe: 'UI_ROOM_CAFE',
    clinic: 'UI_ROOM_CLINIC',
    hotel: 'UI_ROOM_HOTEL',
  };
  const cz = b.coziness;
  const cozyEffect = {
    garage: t('UI_COZY_GARAGE', { p: Math.round(cz.garage_trust_per_point * 100) }),
    cafe: t('UI_COZY_CAFE', { p: Math.round(cz.cafe_tip_per_point * 100) }),
    clinic: t('UI_COZY_CLINIC', { p: Math.round(cz.clinic_heal_per_point * 100) }),
    hotel: t('UI_COZY_HOTEL', { p: Math.round(cz.hotel_fee_per_point * 100) }),
  };
  sec(
    'shop',
    `<h3>${esc(t('UI_SHOP_EQUIP'))}</h3>
     ${table(
       [
         lang === 'sk' ? 'Vybavenie' : 'Equipment',
         lang === 'sk' ? 'Čo robí' : 'Effect',
         lang === 'sk' ? 'Ceny stupňov' : 'Level prices',
       ],
       data.equipment.map((e) => [
         `${e.icon} <b>${esc(t(e.name_key))}</b>`,
         esc(t(e.desc_key)),
         e.prices.map((p) => `${p} €`).join(' · '),
       ]),
     )}
     <h3>${esc(t('UI_SECTION_DECOR'))}</h3>
     <p>${lang === 'sk' ? 'Každá dekorácia pridá miestnosti útulnosť (🛋️). Za každý bod útulnosti:' : 'Each decoration adds coziness (🛋️) to its room. Per point of coziness:'}</p>
     <ul>${rooms.map((r) => `<li><b>${esc(t(roomName[r]))}</b> – ${esc(cozyEffect[r])}</li>`).join('')}</ul>
     ${rooms
       .map(
         (r) =>
           `<h4>${esc(t(roomName[r]))}</h4>${table(
             [lang === 'sk' ? 'Dekorácia' : 'Decoration', '🛋️', lang === 'sk' ? 'Cena' : 'Price'],
             data.decor
               .filter((x) => x.room === r)
               .sort((a, c) => a.price - c.price)
               .map((x) => [
                 esc(t(x.name_key)),
                 `+${x.cozy}`,
                 `${x.price} €${x.unlock ? ` <small>(${esc(t(`UNLOCK_${x.unlock.toUpperCase()}`))})</small>` : ''}`,
               ]),
           )}`,
       )
       .join('')}`,
  );

  // --- Personál
  sec(
    'staff',
    `${table(
      [
        lang === 'sk' ? 'Kto' : 'Who',
        lang === 'sk' ? 'Čo robí' : 'What they do',
        lang === 'sk' ? 'Cena' : 'Price',
      ],
      data.staff.map((s) => [
        `${s.icon} <b>${esc(t(s.name_key))}</b>`,
        esc(t(s.desc_key)),
        `${s.price} €`,
      ]),
    )}
    <p>${lang === 'sk' ? 'Najímajú sa raz (bez mzdy) a dajú sa kedykoľvek poslať na voľno. Ťuknutím na postavičku zistíš, čo sa deje.' : 'Hired once (no wages) and can be sent home any time. Tap a character to hear what’s going on.'}</p>`,
  );

  // --- Kaviareň a ďalšie
  sec(
    'cafe',
    `<ul>
      <li><b>☕ ${esc(t('UI_ROOM_CAFE'))}</b> – ${lang === 'sk' ? `stálice sa presťahujú sem, hostia prichádzajú za nimi. Obsluž ich ťuknutím na bublinu (dar ×${b.cafe.served_multiplier}). Hostia dávajú hodnotenie 1–5 ★ – dobré hodnotenie privedie hostí častejšie.` : `residents move here and guests come to see them. Serve them by tapping the bubble (tip ×${b.cafe.served_multiplier}). Guests rate you 1–5 ★ – a good rating brings guests more often.`}</li>
      <li><b>🏨 ${esc(t('UI_ROOM_HOTEL'))}</b> – ${lang === 'sk' ? 'cudzie mačky na pár minút; spokojný hosť zaplatí viac a prinesie ★.' : 'other people’s cats for a few minutes; a happy guest pays more and brings ★.'}</li>
      <li><b>🌿 ${esc(t('UI_ROOM_CATIO'))}</b> – ${lang === 'sk' ? 'výbeh pre stálice, nudia sa pomalšie.' : 'an outdoor run for residents, they get bored more slowly.'}</li>
      <li><b>🎓 ${esc(t('UI_ROOM_EDUCATION'))}</b> – ${lang === 'sk' ? 'školské výlety; prednáška je kvíz o mačkách.' : 'school trips; the talk is a quiz about cats.'}</li>
    </ul>`,
  );

  // --- Ciele
  sec(
    'goals',
    `<h3>${esc(t('MENU_CHALLENGES'))}</h3>
     <ul>${data.challenges.map((c) => `<li>${esc(t(c.name_key))} – ${c.money} €, +${c.rep} ★</li>`).join('')}</ul>
     <h3>${esc(t('MENU_ACHIEVEMENTS'))} (${data.achievements.length})</h3>
     ${table(
       [
         lang === 'sk' ? 'Úspech' : 'Achievement',
         lang === 'sk' ? 'Podmienka' : 'Goal',
         lang === 'sk' ? 'Odmena' : 'Reward',
       ],
       data.achievements.map((a) => [
         `${a.icon} ${esc(t(`ACH_${a.id.toUpperCase()}`))}`,
         esc(t(`ACHD_${a.kind.toUpperCase()}`, { n: a.target })),
         `${a.money} € + 5 ❤`,
       ]),
     )}
     <h3>${lang === 'sk' ? 'Udalosti' : 'Events'}</h3>
     <ul>${data.events.map((e) => `<li>${e.icon} <b>${esc(t(`EVENT_${e.id.toUpperCase()}`))}</b> – ${esc(t(`EVENT_${e.id.toUpperCase()}_DESC`))}</li>`).join('')}</ul>`,
  );

  // --- Kampane
  const c = b.campaigns;
  sec(
    'city',
    `<p>${esc(t('UI_CITY_INTRO'))}</p>
     <ul>
      <li>${lang === 'sk' ? `Obvod sa vyčistí po ${c.per_district} kampaniach; úrovne: ${t('CITY_TIER_0')} → ${t('CITY_TIER_1')} → ${t('CITY_TIER_2')}.` : `A district is cleared after ${c.per_district} campaigns; levels: ${t('CITY_TIER_0')} → ${t('CITY_TIER_1')} → ${t('CITY_TIER_2')}.`}</li>
      <li>${lang === 'sk' ? `Cena: ${c.base_price} € × ${c.growth}ⁿ. Odmena: +★ a +${c.hearts} ❤, vyčistený obvod +${c.district_hearts} ❤ a o ${Math.round(c.adopter_bonus_per_district * 100)} % častejšie záujemcovia (max ${Math.round(c.adopter_bonus_max * 100)} %).` : `Price: ${c.base_price} € × ${c.growth}ⁿ. Reward: +★ and +${c.hearts} ❤, a cleared district +${c.district_hearts} ❤ and ${Math.round(c.adopter_bonus_per_district * 100)} % more adopters (max ${Math.round(c.adopter_bonus_max * 100)} %).`}</li>
      <li>${lang === 'sk' ? `Nový program 🏅: po hotovej úrovni začneš odznova a lacno; každý certifikát = adopcie +${Math.round(c.prestige_fee * 100)} %, odmeny kampaní +${Math.round(c.prestige_reward * 100)} %.` : `New programme 🏅: after a completed level you restart cheaply; each certificate = adoptions +${Math.round(c.prestige_fee * 100)} %, campaign rewards +${Math.round(c.prestige_reward * 100)} %.`}</li>
     </ul>`,
  );

  // --- Srdiečka
  const cos = data.cosmetics;
  sec(
    'hearts',
    `<p>${lang === 'sk' ? 'Srdiečka (❤) sa nedajú kúpiť za peniaze. Dostaneš ich:' : 'Hearts (❤) cannot be bought with money. You earn them:'}</p>
     <ul>${Object.entries(cos.hearts)
       .map(([k, v]) => `<li>${esc(k.replace(/_/g, ' '))}: +${v} ❤</li>`)
       .join('')}</ul>
     <ul>
      <li>🎉 <b>${esc(t('UI_ADAY_TITLE'))}</b> – ${cos.adoption_day.price} ❤: ${esc(t('UI_ADAY_HINT', { min: Math.round(cos.adoption_day.duration_s / 60) }))}</li>
      <li>💭 <b>${lang === 'sk' ? 'Želania stálic' : 'Resident wishes'}</b> – ${esc(cos.wishes.map((w) => `${w.icon} ${t(`WISH_${w.id.toUpperCase()}`)}`).join(', '))}. ${lang === 'sk' ? `Splnenie prehĺbi puto (max ${cos.wish_rules.bond_max}); každý stupeň = dary stálice +${Math.round(cos.wish_rules.bond_donation * 100)} %.` : `Granting one deepens the bond (max ${cos.wish_rules.bond_max}); each level = resident donations +${Math.round(cos.wish_rules.bond_donation * 100)} %.`}</li>
      <li>🎨 <b>${esc(t('UI_WALLS_TITLE'))}</b> – ${cos.walls.map((w) => `${w.icon} ${esc(t(`WALL_${w.id.toUpperCase()}`))} (${w.price} ❤)`).join(', ')}</li>
     </ul>`,
  );

  // --- Tipy
  sec(
    'tips',
    `<dl>${T.tips.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join('')}</dl>`,
  );

  const other = lang === 'sk' ? 'en/' : '../';
  const game = lang === 'sk' ? '../' : '../../';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(T.title)}</title>
<link rel="icon" type="image/png" href="${game}icon.png">
<style>
:root{--bg:#2b2533;--card:#3b2f45;--line:#e8a87c;--text:#f4e6d0;--dim:#b9a8b8;--good:#9ad17b;--bad:#e86a6a;--warn:#f2c14e}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 Nunito,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--line)}
header{display:flex;gap:16px;align-items:center;padding:20px 16px;max-width:1100px;margin:0 auto}
header img{width:72px;height:72px;image-rendering:pixelated;border-radius:16px;border:2px solid var(--line)}
header h1{margin:0;font-size:26px}
header p{margin:4px 0 0;color:var(--dim)}
.bar{display:flex;gap:8px;flex-wrap:wrap;max-width:1100px;margin:0 auto;padding:0 16px 12px}
.bar a.btn{background:var(--line);color:var(--bg);font-weight:800;text-decoration:none;padding:8px 14px;border-radius:8px}
.bar a.lang{background:var(--card);color:var(--text)}
.bar input{flex:1;min-width:180px;padding:8px 12px;border-radius:8px;border:1px solid #5a4a63;background:var(--card);color:var(--text);font:inherit}
.wrap{display:grid;grid-template-columns:220px 1fr;gap:20px;max-width:1100px;margin:0 auto;padding:0 16px 40px}
nav{position:sticky;top:12px;align-self:start;background:var(--card);border-radius:10px;padding:12px}
nav b{display:block;margin-bottom:6px;color:var(--dim)}
nav a{display:block;padding:3px 0;text-decoration:none;color:var(--text)}
nav a:hover{color:var(--line)}
section{background:var(--card);border-radius:10px;padding:16px 18px;margin-bottom:16px}
section h2{margin:0 0 8px;color:var(--line)}
h3{margin:18px 0 6px} h4{margin:14px 0 4px;color:var(--dim)}
.tw{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #4d4058;vertical-align:middle}
th{color:var(--dim);font-weight:700}
.st{color:var(--warn);letter-spacing:1px}
.good{color:var(--good)} .bad{color:var(--bad)}
.cat{display:inline-block;width:32px;height:32px;background-size:768px 512px;background-position:0 -32px;image-rendering:pixelated;vertical-align:middle;margin-right:6px}
.coats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.coat{display:flex;gap:6px;align-items:center;background:var(--bg);border-radius:8px;padding:6px}
.coat .cat{width:48px;height:48px;background-size:1152px 768px;background-position:0 -48px}
ol.loop li{margin-bottom:6px}
dt{font-weight:800;margin-top:10px} dd{margin:2px 0 0;color:var(--dim)}
.hide{display:none}
@media (max-width:760px){.wrap{grid-template-columns:1fr} nav{position:static}}
</style>
</head>
<body>
<header><img src="${game}icon.png" alt=""><div><h1>${esc(T.title)}</h1><p>${esc(T.lead)}</p></div></header>
<div class="bar"><a class="btn" href="${game}">${T.play}</a><a class="btn lang" href="${other}">${T.other}</a><input id="q" type="search" placeholder="${esc(T.search)}"></div>
<div class="wrap">
<nav><b>${T.toc}</b>${sections.map((s) => `<a href="#${s.id}">${esc(s.title)}</a>`).join('')}</nav>
<main>${sections.map((s) => `<section id="${s.id}"><h2>${esc(s.title)}</h2>${s.html}</section>`).join('\n')}</main>
</div>
<script>
const q=document.getElementById('q');
q.addEventListener('input',()=>{const v=q.value.trim().toLowerCase();
for(const s of document.querySelectorAll('main section')){
  if(!v){s.classList.remove('hide');s.querySelectorAll('tr,li,.coat,dt,dd').forEach(e=>e.classList.remove('hide'));continue;}
  let any=s.querySelector('h2').textContent.toLowerCase().includes(v);
  s.querySelectorAll('tbody tr,li,.coat').forEach(e=>{const m=e.textContent.toLowerCase().includes(v);e.classList.toggle('hide',!m&&!any);if(m)any=true;});
  s.classList.toggle('hide',!any);}});
</script>
</body>
</html>
`;
}

const out = resolve(ROOT, 'dist/wiki');
if (!existsSync(resolve(ROOT, 'dist'))) mkdirSync(resolve(ROOT, 'dist'));
mkdirSync(resolve(out, 'en'), { recursive: true });
writeFileSync(resolve(out, 'index.html'), build('sk'));
writeFileSync(resolve(out, 'en/index.html'), build('en'));
console.log('wiki: dist/wiki/index.html, dist/wiki/en/index.html');
