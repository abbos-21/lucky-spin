import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      telegramUserId?: string;
      telegramUser?: {
        id: number;
        first_name?: string;
        last_name?: string;
        username?: string;
        photo_url?: string;
        language_code?: string;
      };
    }
  }
}

export function validateTelegramAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('tma ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const initData = authHeader.slice(4);
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      res.status(401).json({ error: 'Missing hash' });
      return;
    }

    params.delete('hash');
    const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN!)
      .digest();

    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) {
      res.status(401).json({ error: 'Invalid auth' });
      return;
    }

    const authDate = parseInt(params.get('auth_date') || '0', 10);
    if (Date.now() / 1000 - authDate > 86400) {
      res.status(401).json({ error: 'Auth expired' });
      return;
    }

    const userStr = params.get('user');
    if (!userStr) {
      res.status(401).json({ error: 'No user data' });
      return;
    }

    const user = JSON.parse(userStr);
    req.telegramUserId = user.id?.toString();
    req.telegramUser = user;

    if (!req.telegramUserId) {
      res.status(401).json({ error: 'No user ID' });
      return;
    }

    next();
  } catch {
    res.status(401).json({ error: 'Auth failed' });
  }
}
