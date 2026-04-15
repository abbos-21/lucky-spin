/**
 * Lightweight device fingerprint for anti-abuse tracking.
 * Generates a SHA-256 hash from stable device signals.
 * We only store the hash — never the raw values.
 */
export async function getDeviceFingerprint(): Promise<string> {
  const signals = [
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.language,
    navigator.platform,
    navigator.hardwareConcurrency,
    // Note: WebGL renderer hash requires canvas — omitted for simplicity
    // Can be added later if needed
  ].join('|');

  const msgBuffer = new TextEncoder().encode(signals);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Cached fingerprint — compute once per session */
let _fingerprint: string | null = null;

export async function getFingerprintCached(): Promise<string> {
  if (!_fingerprint) {
    _fingerprint = await getDeviceFingerprint();
  }
  return _fingerprint;
}

/** Generate a random session ID for this app session */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/** Cached session ID — stable for the lifetime of this page load */
const _sessionId = generateSessionId();
export function getSessionId(): string {
  return _sessionId;
}
