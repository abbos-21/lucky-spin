/* eslint-disable @typescript-eslint/no-var-requires */
// tonweb is a CommonJS module with no TypeScript types
const TonWeb = require('tonweb');
const { mnemonicToKeyPair } = require('tonweb-mnemonic');

// ─── Module state ─────────────────────────────────────────────────────────────
let tonweb: any = null;
let hotWallet: any = null;
let cachedKeyPair: any = null;

/**
 * Initialize the hot wallet from environment variables.
 * Called once at server startup. Safe to call multiple times (idempotent).
 */
export async function initHotWallet(): Promise<void> {
  const mnemonic = process.env.TON_MNEMONIC;
  const rpcUrl = process.env.TON_RPC_URL || 'https://testnet.toncenter.com/api/v2/jsonRPC';
  const apiKey = process.env.TONCENTER_API_KEY;

  if (!mnemonic || mnemonic.startsWith('word1')) {
    console.warn('[TON] TON_MNEMONIC not configured — hot wallet disabled');
    return;
  }

  try {
    tonweb = new TonWeb(new TonWeb.HttpProvider(rpcUrl, { apiKey }));

    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 24) {
      console.error('[TON] Mnemonic must be 24 words');
      return;
    }

    cachedKeyPair = await mnemonicToKeyPair(words);

    // Use v4R2 wallet — the standard for most TON wallets
    const WalletClass = tonweb.wallet.all['v4R2'];
    hotWallet = new WalletClass(tonweb.provider, { publicKey: cachedKeyPair.publicKey });

    const address = await hotWallet.getAddress();
    const addrStr = address.toString(true, true, true); // user-friendly, bounceable, url-safe
    console.log(`[TON] Hot wallet ready: ${addrStr}`);
  } catch (err) {
    console.error('[TON] Wallet init failed:', err);
    tonweb = null;
    hotWallet = null;
    cachedKeyPair = null;
  }
}

/**
 * Returns the hot wallet's TON balance, or 0 if the wallet is not initialized.
 */
export async function getHotWalletBalance(): Promise<number> {
  if (!tonweb || !hotWallet) return 0;
  try {
    const address = await hotWallet.getAddress();
    const balanceNano = await tonweb.getBalance(address.toString(true, true, true));
    return Number(TonWeb.utils.fromNano(balanceNano.toString()));
  } catch {
    return 0;
  }
}

/**
 * Send TON from the hot wallet to a user address.
 *
 * Returns { success: true, txHash } on success, or { success: false, error } on failure.
 * The txHash is the external message hash — trackable on TON explorers.
 */
export async function sendTon(
  toAddress: string,
  amountTon: number,
  comment: string = ''
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  if (!tonweb || !hotWallet || !cachedKeyPair) {
    return { success: false, error: 'Hot wallet not initialized' };
  }

  try {
    // Fetch current seqno (nonce) — prevents replay attacks
    const seqno: number = (await hotWallet.methods.seqno().call()) ?? 0;

    const transfer = hotWallet.methods.transfer({
      secretKey: cachedKeyPair.secretKey,
      toAddress: toAddress.trim(),
      amount: TonWeb.utils.toNano(amountTon.toFixed(9)),
      seqno,
      payload: comment || undefined,
      sendMode: 3, // pay fees from balance + ignore action errors
    });

    // Get the message cell hash BEFORE sending — this is what explorers track
    const query = await transfer.getQuery();
    const hashBytes: Uint8Array = await query.hash();
    const txHash = TonWeb.utils.bytesToHex(hashBytes);

    // Broadcast to the network
    await transfer.send();

    return { success: true, txHash };
  } catch (err: any) {
    console.error('[TON] sendTon failed:', err);
    return { success: false, error: err?.message ?? 'Unknown error' };
  }
}

/**
 * Validates a TON address (user-friendly format only — UQ... or EQ...).
 */
export function validateTonAddress(addr: string): { valid: boolean; error?: string } {
  if (!addr?.trim()) {
    return { valid: false, error: 'Address is required.' };
  }
  // User-friendly TON addresses are 48 characters: 2-char prefix + 46 base64url chars
  if (!/^(UQ|EQ)[A-Za-z0-9_-]{46}$/.test(addr.trim())) {
    return { valid: false, error: 'Invalid TON address. Must start with UQ or EQ and be 48 characters.' };
  }
  return { valid: true };
}

export function isWalletReady(): boolean {
  return hotWallet !== null && tonweb !== null;
}
