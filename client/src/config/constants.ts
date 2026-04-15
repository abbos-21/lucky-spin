// Client-side mirror of server CONFIG values used for rendering.
// Do NOT add server-only values (DB paths, secrets, etc.) here.

export const CONFIG = {
  SPIN_SEGMENTS: [
    { label: '25 coins',  type: 'coins',       value: '25',     weight: 25 },
    { label: '50 coins',  type: 'coins',       value: '50',     weight: 20 },
    { label: '100 coins', type: 'coins',       value: '100',    weight: 12 },
    { label: '250 coins', type: 'coins',       value: '250',    weight: 5  },
    { label: 'Ticket',    type: 'ticket',      value: '1',      weight: 15 },
    { label: 'Common',    type: 'collectible', value: 'common', weight: 10 },
    { label: 'Rare',      type: 'collectible', value: 'rare',   weight: 3  },
    { label: 'Jackpot',   type: 'jackpot',     value: '500+3t', weight: 1  },
  ],

  GAME_SCHEDULE: {
    0: 'BubblePop',
    1: 'TapSpeed',
    2: 'MemoryMatch',
    3: 'ReactionTime',
    4: 'ColorSort',
    5: 'MathRush',
    6: 'EmojiRecall',
  } as Record<number, string>,

  GAME_LABELS: {
    BubblePop:    'Bubble Pop',
    TapSpeed:     'Tap Speed',
    MemoryMatch:  'Memory Match',
    ReactionTime: 'Reaction Time',
    ColorSort:    'Color Sort',
    MathRush:     'Math Rush',
    EmojiRecall:  'Emoji Recall',
  } as Record<string, string>,

  MAX_AD_SPINS_PER_DAY: 2,
  MIN_ACTIVE_DAYS: 14,
  MIN_TOTAL_SPINS: 30,
  MIN_GAME_SUBMISSIONS: 10,
  MIN_WITHDRAWAL_TON: 0.3,
  NETWORK_FEE_TON: 0.005,
};

export function getTodayGame(): string {
  return CONFIG.GAME_SCHEDULE[new Date().getUTCDay()];
}

export function getTodayGameLabel(): string {
  return CONFIG.GAME_LABELS[getTodayGame()] ?? getTodayGame();
}
