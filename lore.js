/* ============================================================================
   LORE — the Gate ladder, the Shadow Army, classes and Random Box items.

   All of it is flavour over the log. Nothing here can take anything away:
   a boss that survives the week simply comes back next Monday, a shadow is
   never lost, and items are cosmetic — never XP, never stats.
   ========================================================================= */

/* The ladder, climbing. One boss per week; it dies on the week's 5th kept
   day. An unbeaten boss returns the next Monday. After the 13th the ladder
   starts again and every re-kill raises that shadow's grade. */
export const BOSSES = [
  { id: 'raikans',   name: 'Steel-Fanged Lycans',        rank: 'E', shadow: 'Lycan' },
  { id: 'kasaka',    name: 'Blue Venom-Fanged Kasaka',   rank: 'E', shadow: 'Kasaka' },
  { id: 'werewolf',  name: 'Werewolf',                   rank: 'D', shadow: 'Fang' },
  { id: 'cerberus',  name: 'Cerberus, Keeper of the Gate', rank: 'D', shadow: 'Cerberus' },
  { id: 'ice_bears', name: 'Ice Bears',                  rank: 'C', shadow: 'Tank' },
  { id: 'baruka',    name: 'Baruka, Ice Elf Chieftain',  rank: 'C', shadow: 'Baruka' },
  { id: 'igris',     name: 'Blood-Red Commander Igris',  rank: 'B', shadow: 'Igris' },
  { id: 'metus',     name: 'Metus',                      rank: 'B', shadow: 'Metus' },
  { id: 'vulcan',    name: 'Vulcan, the Demon King',     rank: 'A', shadow: 'Vulcan' },
  { id: 'high_orcs', name: 'High Orc Warband',           rank: 'A', shadow: 'Orc Legion' },
  { id: 'kargalgan', name: 'High Orc Shaman Kargalgan',  rank: 'A', shadow: 'Tusk' },
  { id: 'ant_king',  name: 'The Ant King',               rank: 'S', shadow: 'Beru' },
  { id: 'kamish',    name: 'Kamish, the Dragon',         rank: 'S', shadow: 'Kamish' },
]

/* Shadow grade = kills − 1 + Red Gates on that boss, capped. */
export const GRADES = ['Normal', 'Elite', 'Knight', 'Elite Knight', 'Commander', 'Marshal', 'Grand Marshal']

/* Job Change. The class comes from the dominant stat on the day it is
   revealed — unless you have been raising shadows, in which case the System
   says what the source says. */
export const NECRO_SHADOWS = 3
export const CLASSES = {
  NECRO: { name: 'Necromancer', line: 'A class that commands the dead.' },
  STR:   { name: 'Fighter',     line: 'The body is the weapon.' },
  AGI:   { name: 'Assassin',    line: 'Faster than they can follow.' },
  VIT:   { name: 'Tanker',      line: 'Still standing.' },
  INT:   { name: 'Mage',        line: 'Knowledge, practised daily.' },
  SEN:   { name: 'Ranger',      line: 'Sees the work through.' },
}

/* Random Box. Every fully kept day drops one, chosen by the date itself, so
   it is derived like everything else and cannot be rerolled. */
export const RARITY = [
  { id: 'common',    name: 'Common',    w: 60 },
  { id: 'rare',      name: 'Rare',      w: 28 },
  { id: 'epic',      name: 'Epic',      w: 10 },
  { id: 'legendary', name: 'Legendary', w: 2 },
]

/* kind: aura  — recolours the System (XP bar, diamonds, window edge)
         sigil — reframes the rank emblem
         relic — flavour only */
export const ITEMS = [
  { id: 'aura-violet',  kind: 'aura',  rarity: 'common',    name: 'Violet Aura',   rgb: '157,140,240' },
  { id: 'aura-frost',   kind: 'aura',  rarity: 'common',    name: 'Frost Aura',    rgb: '196,236,255' },
  { id: 'sigil-twin',   kind: 'sigil', rarity: 'common',    name: 'Twin Diamond Sigil' },
  { id: 'relic-potion', kind: 'relic', rarity: 'common',    name: 'Healing Potion',       about: 'Restores nothing. Proof you showed up.' },
  { id: 'relic-herb',   kind: 'relic', rarity: 'common',    name: 'Spirit Herb',          about: 'Smells like the morning you did it anyway.' },
  { id: 'relic-rune',   kind: 'relic', rarity: 'common',    name: 'Rune Stone: Sprint',   about: 'Worn smooth by use.' },

  { id: 'aura-emerald', kind: 'aura',  rarity: 'rare',      name: 'Emerald Aura',  rgb: '86,224,164' },
  { id: 'aura-ember',   kind: 'aura',  rarity: 'rare',      name: 'Ember Aura',    rgb: '255,152,86' },
  { id: 'sigil-rune',   kind: 'sigil', rarity: 'rare',      name: 'Rune Circle Sigil' },
  { id: 'relic-fang',   kind: 'relic', rarity: 'rare',      name: "Kasaka's Venom Fang",  about: 'Paralysis, bottled. Not for use on yourself.' },
  { id: 'relic-knight', kind: 'relic', rarity: 'rare',      name: 'Knight Killer',        about: 'A dagger that asks to be carried daily.' },

  { id: 'aura-gold',    kind: 'aura',  rarity: 'epic',      name: 'Gold Aura',     rgb: '236,190,92' },
  { id: 'aura-crimson', kind: 'aura',  rarity: 'epic',      name: 'Crimson Aura',  rgb: '255,86,104' },
  { id: 'sigil-crown',  kind: 'sigil', rarity: 'epic',      name: 'Crown Sigil' },
  { id: 'relic-orb',    kind: 'relic', rarity: 'epic',      name: 'Orb of Avarice',       about: 'Doubles nothing. Looks incredible.' },
  { id: 'relic-dagger', kind: 'relic', rarity: 'epic',      name: "Demon King's Dagger",  about: 'Taken off Vulcan. Or a copy of it.' },

  { id: 'aura-monarch', kind: 'aura',  rarity: 'legendary', name: "Monarch's Aura", rgb: '178,112,255' },
  { id: 'sigil-flame',  kind: 'sigil', rarity: 'legendary', name: 'Shadow Flame Sigil' },
  { id: 'relic-heart',  kind: 'relic', rarity: 'legendary', name: "Kamish's Heart",      about: 'Still warm.' },
]
