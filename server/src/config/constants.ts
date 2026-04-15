export const CONFIG = {
  // ─── Revenue Split ───
  OWNER_SHARE: 0.50,         // 50% to platform owner
  USER_SHARE: 0.50,          // 50% to users

  // ─── Points Per Ad Type ───
  POINTS_REWARDED_AD: 100,   // Watching a full rewarded video
  POINTS_TASK_AD: 50,        // Completing a task ad on Earn page
  POINTS_SPIN_AD: 80,        // Ad spin (slightly less than direct reward ad)

  // ─── Ad Limits (Per Day) ───
  MAX_REWARDED_ADS_PER_DAY: 10,
  MAX_TASK_ADS_PER_DAY: 3,
  MAX_AD_SPINS_PER_DAY: 2,
  TASK_AD_COOLDOWN_HOURS: 4,

  // ─── Withdrawal ───
  MIN_WITHDRAWAL_TON: 0.3,
  MAX_WITHDRAWAL_TON: 5,
  WITHDRAWAL_COOLDOWN_HOURS: 72,
  MAX_WITHDRAWALS_PER_WEEK: 3,
  NETWORK_FEE_TON: 0.005,
  HOT_WALLET_MIN_RESERVE_TON: 2,

  // ─── Withdrawal Eligibility ───
  MIN_ACTIVE_DAYS: 14,
  MIN_TOTAL_SPINS: 30,
  MIN_GAME_SUBMISSIONS: 10,
  MIN_UNIQUE_ACTIVE_DAYS: 5,

  // ─── Trust Score Thresholds ───
  TRUST_AUTO_APPROVE: 60,    // Auto-process withdrawal
  TRUST_DELAYED: 40,         // 24h delay, soft review
  TRUST_FROZEN: 40,          // Below this: withdrawals frozen

  // ─── Device Fingerprint ───
  MAX_ACCOUNTS_PER_FINGERPRINT: 2,

  // ─── Spin Wheel Segments ───
  SPIN_SEGMENTS: [
    { label: '25 coins',   type: 'coins',       value: '25',      weight: 25 },
    { label: '50 coins',   type: 'coins',       value: '50',      weight: 20 },
    { label: '100 coins',  type: 'coins',       value: '100',     weight: 12 },
    { label: '250 coins',  type: 'coins',       value: '250',     weight: 5  },
    { label: 'Ticket',     type: 'ticket',      value: '1',       weight: 15 },
    { label: 'Common',     type: 'collectible', value: 'common',  weight: 10 },
    { label: 'Rare',       type: 'collectible', value: 'rare',    weight: 3  },
    { label: 'Jackpot',    type: 'jackpot',     value: '500+3t',  weight: 1  },
  ],

  // ─── Mini-Game Schedule ───
  GAME_SCHEDULE: {
    0: 'BubblePop',      // Sunday
    1: 'TapSpeed',       // Monday
    2: 'MemoryMatch',    // Tuesday
    3: 'ReactionTime',   // Wednesday
    4: 'ColorSort',      // Thursday
    5: 'MathRush',       // Friday
    6: 'EmojiRecall',    // Saturday
  } as Record<number, string>,
};
