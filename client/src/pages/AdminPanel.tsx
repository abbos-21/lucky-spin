import { useState, useEffect, useCallback } from 'react';

// ─── Admin API helper ─────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function adminFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  totalUsers: number;
  activeToday: number;
  totalAdViews: number;
  totalWithdrawals: number;
  pendingWithdrawals: number;
  totalTonPaid: number;
  hotWalletBalance: number;
  recentSettlements: Settlement[];
}

interface Settlement {
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

interface WithdrawalItem {
  id: string;
  tonAddress: string;
  amountTon: number;
  fee: number;
  status: string;
  trustScoreAt: number;
  createdAt: string;
  reviewNote?: string;
  user: { username?: string; trustScore: number; activeDays: number; tonWithdrawn: number };
}

interface FraudUser {
  id: string;
  username?: string;
  firstName?: string;
  trustScore: number;
  activeDays: number;
  tonBalance: number;
  isBanned: boolean;
}

interface SearchUser {
  id: string;
  username?: string;
  firstName?: string;
  trustScore: number;
  activeDays: number;
  tonBalance: number;
  isBanned: boolean;
  banReason?: string;
  createdAt: string;
}

type Tab = 'dashboard' | 'settlements' | 'withdrawals' | 'fraud' | 'users';

// ─── Toast ────────────────────────────────────────────────────────────────────

function useAdminToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'ok' | 'err' }[]>([]);
  const add = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return { toasts, ok: (m: string) => add(m, 'ok'), err: (m: string) => add(m, 'err') };
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function AdminPanel() {
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_token') || '');
  const [authed, setAuthed] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [tab, setTab] = useState<Tab>('dashboard');
  const toast = useAdminToast();

  // Validate stored token on mount
  useEffect(() => {
    if (!token) return;
    adminFetch('/api/admin/dashboard', token)
      .then(() => setAuthed(true))
      .catch(() => {
        sessionStorage.removeItem('admin_token');
        setToken('');
      });
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginInput.trim()) return;
    setLoggingIn(true);
    setLoginError('');
    try {
      await adminFetch('/api/admin/dashboard', loginInput.trim());
      sessionStorage.setItem('admin_token', loginInput.trim());
      setToken(loginInput.trim());
      setAuthed(true);
    } catch {
      setLoginError('Invalid admin token.');
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('admin_token');
    setToken('');
    setAuthed(false);
    setLoginInput('');
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-800">
          <h1 className="text-2xl font-black text-white mb-1">🎰 Lucky Spin</h1>
          <p className="text-sm text-gray-400 mb-6">Admin Panel</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              placeholder="Admin token"
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-gray-800 text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-orange-500 text-sm"
            />
            {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
            <button
              type="submit"
              disabled={loggingIn || !loginInput.trim()}
              className="w-full py-3 rounded-xl bg-orange-500 text-white font-bold text-sm disabled:opacity-50"
            >
              {loggingIn ? 'Verifying…' : 'Enter Admin Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Toast overlay */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toast.toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg ${
              t.type === 'ok'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>

      {/* Top bar */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-black text-white">🎰 Lucky Spin Admin</h1>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          Log out
        </button>
      </header>

      {/* Tab nav */}
      <nav className="border-b border-gray-800 px-6 flex gap-1">
        {([
          ['dashboard',   '📊 Dashboard'],
          ['settlements', '💰 Settlements'],
          ['withdrawals', '📤 Withdrawals'],
          ['fraud',       '🚨 Fraud Flags'],
          ['users',       '🔍 User Search'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === key
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="p-6 max-w-5xl mx-auto">
        {tab === 'dashboard'   && <DashboardTab   token={token} toast={toast} />}
        {tab === 'settlements' && <SettlementsTab token={token} toast={toast} />}
        {tab === 'withdrawals' && <WithdrawalsTab token={token} toast={toast} />}
        {tab === 'fraud'       && <FraudTab       token={token} toast={toast} />}
        {tab === 'users'       && <UsersTab       token={token} toast={toast} />}
      </main>
    </div>
  );
}

// ─── Shared props ─────────────────────────────────────────────────────────────

interface TabProps {
  token: string;
  toast: { ok: (m: string) => void; err: (m: string) => void };
}

// ─── Dashboard tab ────────────────────────────────────────────────────────────

function DashboardTab({ token, toast }: TabProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch<DashboardData>('/api/admin/dashboard', token)
      .then(setData)
      .catch(() => toast.err('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <p className="text-gray-400">No data</p>;

  const stats = [
    { label: 'Total Users',        value: data.totalUsers.toLocaleString(),       color: 'text-blue-400' },
    { label: 'Active Today',       value: data.activeToday.toLocaleString(),       color: 'text-green-400' },
    { label: 'Total Ad Views',     value: data.totalAdViews.toLocaleString(),      color: 'text-purple-400' },
    { label: 'Confirmed Withdrawals', value: data.totalWithdrawals.toLocaleString(), color: 'text-orange-400' },
    { label: 'Pending Queue',      value: data.pendingWithdrawals.toLocaleString(), color: data.pendingWithdrawals > 0 ? 'text-yellow-400' : 'text-gray-400' },
    { label: 'Total TON Paid',     value: `${data.totalTonPaid.toFixed(4)} TON`,  color: 'text-cyan-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent settlements */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">Recent Settlements</h2>
        {data.recentSettlements.length === 0 ? (
          <p className="text-gray-500 text-sm">No settlements yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Revenue (USD)</th>
                  <th className="pb-2 pr-4">Users settled</th>
                  <th className="pb-2 pr-4">TON paid</th>
                  <th className="pb-2">pt/TON rate</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSettlements.map((s) => (
                  <tr key={s.id} className="border-b border-gray-800/50 text-gray-200">
                    <td className="py-2 pr-4 font-mono">{s.date}</td>
                    <td className="py-2 pr-4">${s.totalRevenue.toFixed(2)}</td>
                    <td className="py-2 pr-4">{s.usersSettled.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-cyan-400">{s.totalTonPaid.toFixed(6)}</td>
                    <td className="py-2 text-xs text-gray-400">{s.pointValueTon.toFixed(8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settlements tab ──────────────────────────────────────────────────────────

function SettlementsTab({ token, toast }: TabProps) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [revenue, setRevenue] = useState('');
  const [tonPrice, setTonPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ usersSettled: number; totalTonPaid: number } | null>(null);

  async function handleSettle(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !revenue || !tonPrice) return;
    setSubmitting(true);
    try {
      const result = await adminFetch<{ success: boolean; usersSettled: number; totalTonPaid: number }>(
        '/api/admin/settlement',
        token,
        {
          method: 'POST',
          body: JSON.stringify({ date, totalRevenue: parseFloat(revenue), tonPriceUsd: parseFloat(tonPrice) }),
        }
      );
      setLastResult({ usersSettled: result.usersSettled, totalTonPaid: result.totalTonPaid });
      toast.ok(`Settlement complete — ${result.usersSettled} users, ${result.totalTonPaid.toFixed(6)} TON paid`);
      setRevenue('');
      setTonPrice('');
    } catch (err: any) {
      toast.err(err.message ?? 'Settlement failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-bold text-white mb-1">Trigger Daily Settlement</h2>
        <p className="text-sm text-gray-400">
          Enter today's Adsgram revenue. The system will calculate the point → TON exchange rate
          and credit TON to all users who earned points that day.
        </p>
      </div>

      <form onSubmit={handleSettle} className="bg-gray-900 rounded-2xl p-5 border border-gray-800 space-y-4">
        <div className="space-y-1">
          <label className="text-xs text-gray-400 font-medium">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={today}
            className="w-full px-3 py-2.5 rounded-xl bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-orange-500 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-400 font-medium">Total Adsgram Revenue (USD)</label>
          <input
            type="number"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
            placeholder="e.g. 12.50"
            min="0"
            step="0.01"
            className="w-full px-3 py-2.5 rounded-xl bg-gray-800 text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-orange-500 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-400 font-medium">TON Price (USD)</label>
          <input
            type="number"
            value={tonPrice}
            onChange={(e) => setTonPrice(e.target.value)}
            placeholder="e.g. 5.20"
            min="0"
            step="0.01"
            className="w-full px-3 py-2.5 rounded-xl bg-gray-800 text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-orange-500 text-sm"
          />
          <p className="text-xs text-gray-500">
            Check <span className="text-gray-300">coinmarketcap.com/currencies/toncoin</span> for current price.
          </p>
        </div>

        {revenue && tonPrice && (
          <div className="bg-gray-800 rounded-xl p-3 text-xs text-gray-300 space-y-1">
            <p>User share (50%): <span className="text-green-400">${(parseFloat(revenue || '0') * 0.5).toFixed(4)}</span></p>
            <p>Point value: <span className="text-cyan-400">calculated from total points earned that day</span></p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !date || !revenue || !tonPrice}
          className="w-full py-3 rounded-xl bg-orange-500 text-white font-bold text-sm disabled:opacity-50"
        >
          {submitting ? 'Running settlement…' : 'Run Settlement'}
        </button>
      </form>

      {lastResult && (
        <div className="bg-green-900/30 border border-green-700 rounded-2xl p-4 text-sm space-y-1">
          <p className="text-green-400 font-bold">✅ Settlement complete</p>
          <p className="text-gray-300">Users settled: <span className="font-semibold">{lastResult.usersSettled}</span></p>
          <p className="text-gray-300">TON distributed: <span className="font-semibold text-cyan-400">{lastResult.totalTonPaid.toFixed(6)} TON</span></p>
        </div>
      )}
    </div>
  );
}

// ─── Withdrawals tab ──────────────────────────────────────────────────────────

function WithdrawalsTab({ token, toast }: TabProps) {
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
  const [acting, setActing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ withdrawals: WithdrawalItem[] }>(
        `/api/admin/withdrawals?status=${statusFilter}`,
        token
      );
      setWithdrawals(data.withdrawals);
    } catch {
      toast.err('Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, token]);

  useEffect(() => { load(); }, [load]);

  async function approve(id: string) {
    setActing(id);
    try {
      await adminFetch(`/api/admin/withdrawals/${id}/approve`, token, {
        method: 'POST',
        body: JSON.stringify({ note: notes[id] || undefined }),
      });
      toast.ok('Approved — queued for processing');
      setWithdrawals((w) => w.filter((x) => x.id !== id));
    } catch (err: any) {
      toast.err(err.message ?? 'Failed');
    } finally {
      setActing(null);
    }
  }

  async function reject(id: string) {
    setActing(id);
    try {
      await adminFetch(`/api/admin/withdrawals/${id}/reject`, token, {
        method: 'POST',
        body: JSON.stringify({ reason: notes[id] || undefined }),
      });
      toast.ok('Rejected — balance refunded to user');
      setWithdrawals((w) => w.filter((x) => x.id !== id));
    } catch (err: any) {
      toast.err(err.message ?? 'Failed');
    } finally {
      setActing(null);
    }
  }

  const statusOptions = ['PENDING_REVIEW', 'PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED', 'REJECTED'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-base font-bold text-white">Withdrawals</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-sm border border-gray-700 focus:outline-none"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-sm border border-gray-700 hover:text-white"
        >
          Refresh
        </button>
      </div>

      {loading && <Spinner />}

      {!loading && withdrawals.length === 0 && (
        <p className="text-gray-400 text-sm">No withdrawals with status: {statusFilter}</p>
      )}

      {!loading && withdrawals.map((w) => (
        <div key={w.id} className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-0.5 min-w-0">
              <p className="text-base font-bold text-white">{w.amountTon.toFixed(4)} TON</p>
              <p className="text-xs font-mono text-gray-400 truncate">{w.tonAddress}</p>
              <p className="text-xs text-gray-500">{new Date(w.createdAt).toLocaleString()}</p>
            </div>
            <div className="text-right shrink-0 space-y-0.5">
              <p className="text-sm font-semibold text-gray-200">
                {w.user.username ? `@${w.user.username}` : 'Unknown user'}
              </p>
              <p className="text-xs text-gray-400">Trust: <span className={w.user.trustScore < 40 ? 'text-red-400' : w.user.trustScore < 60 ? 'text-yellow-400' : 'text-green-400'}>{w.user.trustScore}</span></p>
              <p className="text-xs text-gray-400">Active: {w.user.activeDays}d · Withdrawn: {w.user.tonWithdrawn.toFixed(2)} TON</p>
            </div>
          </div>

          {statusFilter === 'PENDING_REVIEW' && (
            <div className="space-y-2">
              <input
                type="text"
                value={notes[w.id] || ''}
                onChange={(e) => setNotes((n) => ({ ...n, [w.id]: e.target.value }))}
                placeholder="Optional note / reason…"
                className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white text-sm placeholder-gray-500 border border-gray-700 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => approve(w.id)}
                  disabled={acting === w.id}
                  className="flex-1 py-2 rounded-lg bg-green-600 text-white font-semibold text-sm disabled:opacity-50 hover:bg-green-500 transition-colors"
                >
                  ✅ Approve
                </button>
                <button
                  onClick={() => reject(w.id)}
                  disabled={acting === w.id}
                  className="flex-1 py-2 rounded-lg bg-red-700 text-white font-semibold text-sm disabled:opacity-50 hover:bg-red-600 transition-colors"
                >
                  ❌ Reject
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Fraud flags tab ──────────────────────────────────────────────────────────

function FraudTab({ token, toast }: TabProps) {
  const [users, setUsers] = useState<FraudUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    adminFetch<{ users: FraudUser[] }>('/api/admin/fraud-flags', token)
      .then((d) => setUsers(d.users))
      .catch(() => toast.err('Failed to load fraud flags'))
      .finally(() => setLoading(false));
  }, []);

  async function ban(id: string) {
    setActing(id);
    try {
      await adminFetch(`/api/admin/users/${id}/ban`, token, {
        method: 'POST',
        body: JSON.stringify({ reason: reasons[id] || 'Banned by admin' }),
      });
      toast.ok('User banned');
      setUsers((u) => u.map((x) => (x.id === id ? { ...x, isBanned: true } : x)));
    } catch (err: any) {
      toast.err(err.message ?? 'Failed');
    } finally {
      setActing(null);
    }
  }

  async function unban(id: string) {
    setActing(id);
    try {
      await adminFetch(`/api/admin/users/${id}/unban`, token, { method: 'POST' });
      toast.ok('User unbanned');
      setUsers((u) => u.map((x) => (x.id === id ? { ...x, isBanned: false } : x)));
    } catch (err: any) {
      toast.err(err.message ?? 'Failed');
    } finally {
      setActing(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">Fraud Flags</h2>
        <p className="text-xs text-gray-400">{users.length} user{users.length !== 1 ? 's' : ''} with trust score &lt; 40</p>
      </div>

      {users.length === 0 && (
        <p className="text-gray-400 text-sm">No flagged users.</p>
      )}

      {users.map((u) => (
        <div key={u.id} className={`bg-gray-900 rounded-2xl p-4 border space-y-3 ${u.isBanned ? 'border-red-900' : 'border-gray-800'}`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white">
                  {u.username ? `@${u.username}` : u.firstName || 'Unknown'}
                </p>
                {u.isBanned && (
                  <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">Banned</span>
                )}
              </div>
              <p className="text-xs text-gray-500 font-mono">ID: {u.id}</p>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-sm font-bold text-red-400">Trust: {u.trustScore}</p>
              <p className="text-xs text-gray-400">Active: {u.activeDays}d</p>
              <p className="text-xs text-gray-400">Balance: {u.tonBalance.toFixed(4)} TON</p>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={reasons[u.id] || ''}
              onChange={(e) => setReasons((r) => ({ ...r, [u.id]: e.target.value }))}
              placeholder="Ban reason…"
              className="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm placeholder-gray-500 border border-gray-700 focus:outline-none"
            />
            {u.isBanned ? (
              <button
                onClick={() => unban(u.id)}
                disabled={acting === u.id}
                className="px-4 py-2 rounded-lg bg-gray-700 text-gray-200 font-semibold text-sm disabled:opacity-50 hover:bg-gray-600 transition-colors whitespace-nowrap"
              >
                Unban
              </button>
            ) : (
              <button
                onClick={() => ban(u.id)}
                disabled={acting === u.id}
                className="px-4 py-2 rounded-lg bg-red-700 text-white font-semibold text-sm disabled:opacity-50 hover:bg-red-600 transition-colors whitespace-nowrap"
              >
                Ban
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Users search tab ─────────────────────────────────────────────────────────

function UsersTab({ token, toast }: TabProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearched(false);
    try {
      const data = await adminFetch<{ users: SearchUser[] }>(
        `/api/admin/users/search?q=${encodeURIComponent(query.trim())}`,
        token
      );
      setResults(data.users);
      setSearched(true);
    } catch (err: any) {
      toast.err(err.message ?? 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function ban(id: string) {
    setActing(id);
    try {
      await adminFetch(`/api/admin/users/${id}/ban`, token, {
        method: 'POST',
        body: JSON.stringify({ reason: reasons[id] || 'Banned by admin' }),
      });
      toast.ok('User banned');
      setResults((u) => u.map((x) => (x.id === id ? { ...x, isBanned: true } : x)));
    } catch (err: any) {
      toast.err(err.message ?? 'Failed');
    } finally {
      setActing(null);
    }
  }

  async function unban(id: string) {
    setActing(id);
    try {
      await adminFetch(`/api/admin/users/${id}/unban`, token, { method: 'POST' });
      toast.ok('User unbanned');
      setResults((u) => u.map((x) => (x.id === id ? { ...x, isBanned: false } : x)));
    } catch (err: any) {
      toast.err(err.message ?? 'Failed');
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-white mb-1">User Search</h2>
        <p className="text-sm text-gray-400">Search by Telegram ID (exact) or username (partial match).</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="User ID or @username…"
          className="flex-1 px-4 py-2.5 rounded-xl bg-gray-900 text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-orange-500 text-sm"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm disabled:opacity-50 hover:bg-orange-400 transition-colors"
        >
          {searching ? '…' : 'Search'}
        </button>
      </form>

      {searching && <Spinner />}

      {!searching && searched && results.length === 0 && (
        <p className="text-gray-400 text-sm">No users found for "{query}".</p>
      )}

      {!searching && results.map((u) => (
        <div
          key={u.id}
          className={`bg-gray-900 rounded-2xl p-4 border space-y-3 ${u.isBanned ? 'border-red-900' : 'border-gray-800'}`}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-white">
                  {u.username ? `@${u.username}` : u.firstName || 'Unknown'}
                </p>
                {u.isBanned && (
                  <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">Banned</span>
                )}
              </div>
              <p className="text-xs text-gray-500 font-mono">ID: {u.id}</p>
              <p className="text-xs text-gray-500">Joined: {new Date(u.createdAt).toLocaleDateString()}</p>
              {u.isBanned && u.banReason && (
                <p className="text-xs text-red-400/80">Reason: {u.banReason}</p>
              )}
            </div>
            <div className="text-right space-y-0.5 shrink-0">
              <p className={`text-sm font-bold ${u.trustScore < 40 ? 'text-red-400' : u.trustScore < 60 ? 'text-yellow-400' : 'text-green-400'}`}>
                Trust: {u.trustScore}
              </p>
              <p className="text-xs text-gray-400">Active: {u.activeDays}d</p>
              <p className="text-xs text-gray-400">Balance: {u.tonBalance.toFixed(4)} TON</p>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={reasons[u.id] || ''}
              onChange={(e) => setReasons((r) => ({ ...r, [u.id]: e.target.value }))}
              placeholder="Ban reason…"
              className="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm placeholder-gray-500 border border-gray-700 focus:outline-none"
            />
            {u.isBanned ? (
              <button
                onClick={() => unban(u.id)}
                disabled={acting === u.id}
                className="px-4 py-2 rounded-lg bg-gray-700 text-gray-200 font-semibold text-sm disabled:opacity-50 hover:bg-gray-600 transition-colors whitespace-nowrap"
              >
                Unban
              </button>
            ) : (
              <button
                onClick={() => ban(u.id)}
                disabled={acting === u.id}
                className="px-4 py-2 rounded-lg bg-red-700 text-white font-semibold text-sm disabled:opacity-50 hover:bg-red-600 transition-colors whitespace-nowrap"
              >
                Ban
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-6 h-6 border-2 border-gray-600 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}
