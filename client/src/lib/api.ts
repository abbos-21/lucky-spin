import { getInitData } from './telegram';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Core fetch wrapper — attaches Telegram initData as Authorization header.
 * Every API call goes through here.
 */
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const initData = getInitData();
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(initData ? { Authorization: `tma ${initData}` } : {}),
    ...options.headers,
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errorMessage = body.error || body.message || errorMessage;
    } catch {
      // Use default message
    }
    throw new ApiError(res.status, errorMessage);
  }

  return res.json() as Promise<T>;
}

// ─── Typed API methods ────────────────────────────────────────────────────────

export const api = {
  // ── User ──────────────────────────────────────────────────
  user: {
    init: (fingerprintHash?: string) =>
      request<{ user: User }>('/api/user/init', {
        method: 'POST',
        body: JSON.stringify({ fingerprintHash }),
      }),

    profile: () =>
      request<{ user: User; stats: UserStats }>('/api/user/profile'),
  },

  // ── Spin ──────────────────────────────────────────────────
  spin: {
    spin: (isAdSpin = false) =>
      request<SpinResult>('/api/spin', {
        method: 'POST',
        body: JSON.stringify({ isAdSpin }),
      }),
  },

  // ── Game ──────────────────────────────────────────────────
  game: {
    submit: (gameType: string, rawScore: number, isBoosted = false) =>
      request<GameSubmitResult>('/api/game/submit', {
        method: 'POST',
        body: JSON.stringify({ gameType, rawScore, isBoosted }),
      }),

    leaderboard: () =>
      request<LeaderboardResult>('/api/game/leaderboard'),

    status: () =>
      request<{
        gameType: string;
        date: string;
        submitted: boolean;
        submission: { score: number; rawScore: number; isBoosted: boolean } | null;
        adScoreBoost: boolean;
      }>('/api/game/status'),
  },

  // ── Earn ──────────────────────────────────────────────────
  earn: {
    adReward: (adType: string, sessionId: string, fingerprintHash: string) =>
      request<AdRewardResult>('/api/earn/ad-reward', {
        method: 'POST',
        body: JSON.stringify({ adType, sessionId, fingerprintHash }),
      }),

    tasks: () => request<EarnTasksResult>('/api/earn/tasks'),

    socialTask: (taskType: string) =>
      request<{ success: boolean; coinsAwarded: number }>('/api/earn/social-task', {
        method: 'POST',
        body: JSON.stringify({ taskType }),
      }),

    referral: () => request<{ referralLink: string; totalReferrals: number; activeReferrals: number }>('/api/earn/referral'),
  },

  // ── Withdraw ──────────────────────────────────────────────
  withdraw: {
    info: () => request<WithdrawInfo>('/api/withdraw/info'),

    history: () => request<{ withdrawals: Withdrawal[] }>('/api/withdraw/history'),

    submit: (tonAddress: string, amountTon: number) =>
      request<WithdrawResult>('/api/withdraw', {
        method: 'POST',
        body: JSON.stringify({ tonAddress, amountTon }),
      }),
  },

  // ── Admin ─────────────────────────────────────────────────
  admin: {
    dashboard: (adminToken: string) =>
      request<AdminDashboard>('/api/admin/dashboard', {
        headers: { 'x-admin-token': adminToken },
      }),

    settlement: (adminToken: string, data: SettlementInput) =>
      request<SettlementResult>('/api/admin/settlement', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
        body: JSON.stringify(data),
      }),

    withdrawals: (adminToken: string, status = 'PENDING_REVIEW') =>
      request<{ withdrawals: AdminWithdrawal[] }>(`/api/admin/withdrawals?status=${status}`, {
        headers: { 'x-admin-token': adminToken },
      }),

    approveWithdrawal: (adminToken: string, id: string, note?: string) =>
      request<{ success: boolean }>(`/api/admin/withdrawals/${id}/approve`, {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
        body: JSON.stringify({ note }),
      }),

    rejectWithdrawal: (adminToken: string, id: string, reason?: string) =>
      request<{ success: boolean }>(`/api/admin/withdrawals/${id}/reject`, {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
        body: JSON.stringify({ reason }),
      }),

    fraudFlags: (adminToken: string) =>
      request<{ users: FraudUser[] }>('/api/admin/fraud-flags', {
        headers: { 'x-admin-token': adminToken },
      }),

    banUser: (adminToken: string, userId: string, reason?: string) =>
      request<{ success: boolean }>(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
        body: JSON.stringify({ reason }),
      }),
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username?: string;
  firstName?: string;
  photoUrl?: string;
  pointsBalance: number;
  tonBalance: number;
  tonWithdrawn: number;
  totalPointsEarned: number;
  coins: number;
  streak: number;
  longestStreak: number;
  lastSpinDate?: string;
  adSpinsToday: number;
  adScoreBoost: boolean;
  streakShield: boolean;
  trustScore: number;
  activeDays: number;
  lastActiveDate?: string;
  isBanned: boolean;
  tonAddress?: string;
  createdAt: string;
}

export interface UserStats {
  totalSpins: number;
  totalGameSubmissions: number;
  collectiblesUnlocked: number;
  collectibles: Array<{ collectibleId: string; obtainedAt: string }>;
}

export interface SpinResult {
  segmentIndex: number;
  reward: {
    type: string;
    value: string;
    label: string;
  };
  user: Partial<User>;
}

export interface GameSubmitResult {
  score: number;
  rawScore: number;
  isBoosted: boolean;
  rank?: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username?: string;
  firstName?: string;
  photoUrl?: string;
  score: number;
  isBoosted: boolean;
  isCurrentUser: boolean;
}

export interface LeaderboardResult {
  gameType: string;
  date: string;
  entries: LeaderboardEntry[];
  currentUserRank?: number;
}

export interface AdRewardResult {
  success: boolean;
  pointsAwarded: number;
  adViewId: string;
}

export interface TasksResult {
  tasks: Task[];
  todayPoints: number;
  totalPointsEarned: number;
}

export interface Task {
  id: string;
  type: 'ad' | 'social';
  label: string;
  adType?: string;
  points: number;
  completed: boolean;
  cooldownEndsAt?: string;
}

export interface AdTask {
  id: string;
  adType: string;
  label: string;
  points: number;
  cooldownEndsAt: string | null;
  exhausted: boolean;
}

export interface SocialTask {
  id: string;
  label: string;
  reward: string;
  rewardCoins: number;
  completed?: boolean;
  url?: string;
  referralLink?: string;
  referralCount?: number;
}

export interface EarnTasksResult {
  todayPoints: number;
  totalPointsEarned: number;
  tasks: {
    adTasks: AdTask[];
    spinInfo: { adSpinsUsed: number; adSpinsMax: number; pointsPerSpin: number };
    scoreBoostInfo: { used: boolean; pointsForViewing: number };
    socialTasks: SocialTask[];
  };
}

export interface WithdrawInfo {
  tonBalance: number;
  pointsBalance: number;
  tonWithdrawn: number;
  savedAddress?: string;
  trustScore: number;
  eligibility: {
    canWithdraw: boolean;
    activeDays: number;
    activeDaysRequired: number;
    totalSpins: number;
    spinsRequired: number;
    gameSubmissions: number;
    gamesRequired: number;
  };
  config: {
    minTon: number;
    maxTon: number;
    fee: number;
    cooldownHours: number;
  };
}

export interface Withdrawal {
  id: string;
  tonAddress: string;
  amountTon: number;
  fee: number;
  status: 'PENDING' | 'PENDING_REVIEW' | 'PROCESSING' | 'CONFIRMED' | 'FAILED' | 'REJECTED';
  txHash?: string;
  failReason?: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface WithdrawResult {
  success: boolean;
  withdrawal: Withdrawal;
  newBalance: number;
}

export interface AdminDashboard {
  totalUsers: number;
  activeToday: number;
  totalAdViews: number;
  totalWithdrawals: number;
  pendingWithdrawals: number;
  totalTonPaid: number;
  hotWalletBalance: number;
  recentSettlements: DailySettlement[];
}

export interface DailySettlement {
  id: string;
  date: string;
  totalRevenue: number;
  userShareUsd: number;
  totalPoints: number;
  pointValueTon: number;
  usersSettled: number;
  totalTonPaid: number;
  settledAt: string;
}

export interface SettlementInput {
  date: string;
  totalRevenue: number;
  tonPriceUsd: number;
}

export interface SettlementResult {
  success: boolean;
  usersSettled: number;
  totalTonPaid: number;
}

export interface AdminWithdrawal extends Withdrawal {
  user: {
    username?: string;
    trustScore: number;
    activeDays: number;
    tonWithdrawn: number;
  };
}

export interface FraudUser {
  id: string;
  username?: string;
  trustScore: number;
  activeDays: number;
  tonBalance: number;
  isBanned: boolean;
}
