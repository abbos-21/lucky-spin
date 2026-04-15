import { Bot, InlineKeyboard } from 'grammy';
import { prisma } from '../lib/prisma';

let bot: Bot | null = null;

export function createBot(): Bot {
  const token = process.env.BOT_TOKEN;
  if (!token || token === 'your_telegram_bot_token_here') {
    console.warn('[Bot] BOT_TOKEN not set — bot will not start.');
    return null as any;
  }

  bot = new Bot(token);

  // /start command — opens Mini App
  bot.command('start', async (ctx) => {
    const miniAppUrl = process.env.MINI_APP_URL || 'https://your-app.vercel.app';
    const userId = ctx.from?.id;
    const startParam = ctx.match; // referral code if present: "ref_123456"

    // Handle referral link
    if (startParam?.startsWith('ref_') && userId) {
      const referrerId = BigInt(startParam.slice(4));
      const referredId = BigInt(userId);

      if (referrerId !== referredId) {
        try {
          // Check if referred user already exists (don't double-credit)
          const existing = await prisma.referral.findUnique({
            where: { referrerId_referredId: { referrerId, referredId } },
          });

          if (!existing) {
            // Create referral record — bonus is awarded on first spin (Phase 6)
            await prisma.referral.create({
              data: { referrerId, referredId },
            }).catch(() => {
              // Silently ignore if referrer doesn't exist yet
            });
          }
        } catch {
          // Non-critical — don't fail the start command
        }
      }
    }

    const keyboard = new InlineKeyboard().webApp(
      '🎰 Play Lucky Spin',
      miniAppUrl
    );

    await ctx.reply(
      `🎰 *Welcome to Lucky Spin!*\n\n` +
        `Spin the wheel daily, play mini-games, watch ads, and earn real TON!\n\n` +
        `✅ Free daily spin\n` +
        `🎮 7 daily mini-games\n` +
        `💎 Collect rare items\n` +
        `💸 Withdraw earnings as TON\n\n` +
        `Tap the button below to start playing!`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `*Lucky Spin Help*\n\n` +
        `🎰 *Spin* — Free daily spin + watch ads for extra spins\n` +
        `🎮 *Game* — Daily mini-game challenge\n` +
        `🏆 *Board* — Leaderboard rankings\n` +
        `💰 *Earn* — Watch ads and complete tasks for points\n` +
        `👤 *Profile* — Stats, collectibles, and withdrawal\n\n` +
        `*How earnings work:*\n` +
        `1. Watch ads → earn Points\n` +
        `2. Points convert to TON nightly\n` +
        `3. Withdraw when you reach 0.3 TON\n\n` +
        `Play 14+ days to unlock withdrawals!`,
      { parse_mode: 'Markdown' }
    );
  });

  // Handle errors gracefully
  bot.catch((err) => {
    console.error('[Bot] Error:', err);
  });

  return bot;
}

export function startBot(): void {
  const b = createBot();
  if (!b) return;

  b.start({
    onStart: (info) => {
      console.log(`[Bot] @${info.username} started successfully`);
    },
  });
}

export { bot };
