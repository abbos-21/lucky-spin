export type Rarity = 'common' | 'rare';

export interface Collectible {
  id: string;
  emoji: string;
  name: string;
  rarity: Rarity;
  theme: string;
}

export interface Theme {
  key: string;
  label: string;
  rarity: Rarity;
  ids: string[];
}

// ─── 10 themes × 10 items = 100 collectibles ─────────────────────────────────
// Themes 1–7: common rarity   (70 items)
// Themes 8–10: rare rarity    (30 items)

const THEME_DATA: { key: string; label: string; rarity: Rarity; items: { emoji: string; name: string }[] }[] = [
  {
    key: 'animals', label: '🐾 Animals', rarity: 'common',
    items: [
      { emoji: '🐱', name: 'Lucky Cat' },
      { emoji: '🐶', name: 'Happy Pup' },
      { emoji: '🐻', name: 'Teddy Bear' },
      { emoji: '🐼', name: 'Panda Pal' },
      { emoji: '🐨', name: 'Koala Nap' },
      { emoji: '🐯', name: 'Tiger Stripe' },
      { emoji: '🦁', name: 'Lion Heart' },
      { emoji: '🦊', name: 'Clever Fox' },
      { emoji: '🐺', name: 'Night Wolf' },
      { emoji: '🐸', name: 'Leap Frog' },
    ],
  },
  {
    key: 'nature', label: '🌿 Nature', rarity: 'common',
    items: [
      { emoji: '🌸', name: 'Cherry Bloom' },
      { emoji: '🌺', name: 'Hibiscus' },
      { emoji: '🌻', name: 'Sunflower' },
      { emoji: '🌹', name: 'Red Rose' },
      { emoji: '🍀', name: 'Lucky Clover' },
      { emoji: '🌿', name: 'Fresh Leaf' },
      { emoji: '🍁', name: 'Autumn Leaf' },
      { emoji: '🌴', name: 'Palm Tree' },
      { emoji: '🌵', name: 'Desert Spike' },
      { emoji: '🎋', name: 'Bamboo Shoot' },
    ],
  },
  {
    key: 'food', label: '🍎 Food', rarity: 'common',
    items: [
      { emoji: '🍎', name: 'Red Apple' },
      { emoji: '🍊', name: 'Tangerine' },
      { emoji: '🍋', name: 'Lemon Drop' },
      { emoji: '🍇', name: 'Grape Bunch' },
      { emoji: '🍓', name: 'Strawberry' },
      { emoji: '🍑', name: 'Peach Fuzz' },
      { emoji: '🍍', name: 'Pineapple King' },
      { emoji: '🥝', name: 'Kiwi Bird' },
      { emoji: '🥥', name: 'Coconut' },
      { emoji: '🍄', name: 'Lucky Shroom' },
    ],
  },
  {
    key: 'music', label: '🎵 Music', rarity: 'common',
    items: [
      { emoji: '🎸', name: 'Rock Guitar' },
      { emoji: '🎺', name: 'Brass Horn' },
      { emoji: '🎻', name: 'Violin Song' },
      { emoji: '🎷', name: 'Saxophone' },
      { emoji: '🥁', name: 'Drum Beat' },
      { emoji: '🎹', name: 'Piano Keys' },
      { emoji: '🎵', name: 'Music Note' },
      { emoji: '🎶', name: 'Double Note' },
      { emoji: '🎤', name: 'Microphone' },
      { emoji: '🎧', name: 'Headphones' },
    ],
  },
  {
    key: 'sports', label: '⚽ Sports', rarity: 'common',
    items: [
      { emoji: '🏀', name: 'Basketball' },
      { emoji: '⚽', name: 'Soccer Ball' },
      { emoji: '🎾', name: 'Tennis Ace' },
      { emoji: '🏓', name: 'Ping Pong' },
      { emoji: '🎱', name: 'Eight Ball' },
      { emoji: '🏈', name: 'Football' },
      { emoji: '⚾', name: 'Baseball' },
      { emoji: '🏐', name: 'Volleyball' },
      { emoji: '🎯', name: 'Bulls Eye' },
      { emoji: '🎳', name: 'Strike' },
    ],
  },
  {
    key: 'travel', label: '✈️ Travel', rarity: 'common',
    items: [
      { emoji: '🗼', name: 'Eiffel Tower' },
      { emoji: '🏝️', name: 'Desert Island' },
      { emoji: '🗻', name: 'Mount Fuji' },
      { emoji: '🌆', name: 'City at Dusk' },
      { emoji: '🏖️', name: 'Beach Day' },
      { emoji: '✈️', name: 'Airplane' },
      { emoji: '🚢', name: 'Cruise Ship' },
      { emoji: '🏔️', name: 'Snowy Peak' },
      { emoji: '🌍', name: 'Globe' },
      { emoji: '🗺️', name: 'World Map' },
    ],
  },
  {
    key: 'fantasy', label: '🧙 Fantasy', rarity: 'common',
    items: [
      { emoji: '🧙', name: 'Wizard' },
      { emoji: '🧚', name: 'Fairy' },
      { emoji: '🦸', name: 'Hero' },
      { emoji: '🧝', name: 'Elf' },
      { emoji: '🧜', name: 'Mermaid' },
      { emoji: '🦄', name: 'Unicorn' },
      { emoji: '🧞', name: 'Genie' },
      { emoji: '🧛', name: 'Vampire' },
      { emoji: '🧟', name: 'Zombie' },
      { emoji: '🦹', name: 'Villain' },
    ],
  },
  {
    key: 'ocean', label: '🌊 Ocean', rarity: 'rare',
    items: [
      { emoji: '🐬', name: 'Flipper' },
      { emoji: '🐙', name: 'Eight Arms' },
      { emoji: '🦈', name: 'Great White' },
      { emoji: '🐠', name: 'Clown Fish' },
      { emoji: '🐳', name: 'Blue Whale' },
      { emoji: '🦞', name: 'Lobster' },
      { emoji: '🐡', name: 'Puffer Fish' },
      { emoji: '🦑', name: 'Squid' },
      { emoji: '🦀', name: 'Red Crab' },
      { emoji: '🐚', name: 'Seashell' },
    ],
  },
  {
    key: 'space', label: '🚀 Space', rarity: 'rare',
    items: [
      { emoji: '🌟', name: 'Golden Star' },
      { emoji: '⭐', name: 'Shooting Star' },
      { emoji: '🌙', name: 'Crescent Moon' },
      { emoji: '🌠', name: 'Falling Star' },
      { emoji: '🚀', name: 'Rocket' },
      { emoji: '🛸', name: 'UFO' },
      { emoji: '💫', name: 'Shooting Comet' },
      { emoji: '⚡', name: 'Thunder Strike' },
      { emoji: '☄️', name: 'Comet' },
      { emoji: '🌌', name: 'Milky Way' },
    ],
  },
  {
    key: 'gems', label: '💎 Gems', rarity: 'rare',
    items: [
      { emoji: '💎', name: 'Diamond Gem' },
      { emoji: '👑', name: 'Royal Crown' },
      { emoji: '🔮', name: 'Crystal Ball' },
      { emoji: '💍', name: 'Diamond Ring' },
      { emoji: '🔱', name: 'Trident' },
      { emoji: '🏆', name: 'Grand Champion' },
      { emoji: '🥇', name: 'Gold Medal' },
      { emoji: '🗝️', name: 'Golden Key' },
      { emoji: '🧿', name: 'Evil Eye' },
      { emoji: '🪄', name: 'Magic Wand' },
    ],
  },
];

// ─── Build exports ────────────────────────────────────────────────────────────

export const COLLECTIBLES: Record<string, Collectible> = {};
export const THEMES: Theme[] = [];
export const ALL_COLLECTIBLE_IDS: string[] = [];

for (const themeData of THEME_DATA) {
  const ids: string[] = [];
  themeData.items.forEach((item, i) => {
    const id = `${themeData.key}_${i + 1}`;
    COLLECTIBLES[id] = {
      id,
      emoji: item.emoji,
      name: item.name,
      rarity: themeData.rarity,
      theme: themeData.key,
    };
    ids.push(id);
    ALL_COLLECTIBLE_IDS.push(id);
  });
  THEMES.push({ key: themeData.key, label: themeData.label, rarity: themeData.rarity, ids });
}
