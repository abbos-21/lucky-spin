// Adsgram SDK wrapper
// The SDK script is loaded via <script> tag in index.html

declare global {
  interface Window {
    Adsgram?: {
      init(options: { blockId: string; debug?: boolean }): AdsgramController;
    };
  }
}

interface AdsgramController {
  show(): Promise<AdsgramResult>;
}

export interface AdsgramResult {
  done: boolean;      // true = user watched the full ad
  error?: string;
  description?: string;
}

let controller: AdsgramController | null = null;

/**
 * Initialize Adsgram SDK — call once on app mount.
 * Block ID comes from VITE_ADSGRAM_BLOCK_ID env var.
 */
export function initAdsgram(): void {
  const blockId = import.meta.env.VITE_ADSGRAM_BLOCK_ID;
  if (!blockId) {
    console.warn('[Adsgram] VITE_ADSGRAM_BLOCK_ID not set — ads disabled');
    return;
  }

  if (!window.Adsgram) {
    // SDK not loaded yet — retry once the script loads
    const check = setInterval(() => {
      if (window.Adsgram) {
        clearInterval(check);
        controller = window.Adsgram.init({ blockId });
        console.log('[Adsgram] Initialized with block ID:', blockId);
      }
    }, 500);

    // Give up after 10 seconds
    setTimeout(() => clearInterval(check), 10_000);
    return;
  }

  controller = window.Adsgram.init({ blockId });
  console.log('[Adsgram] Initialized with block ID:', blockId);
}

/**
 * Show a rewarded ad. Returns result with done=true if watched fully.
 * Never throws — always returns a result object.
 */
export async function showRewardedAd(): Promise<AdsgramResult> {
  if (!controller) {
    return { done: false, error: 'Adsgram not initialized' };
  }

  try {
    const result = await controller.show();
    return result;
  } catch (err: any) {
    console.error('[Adsgram] Ad show error:', err);
    return {
      done: false,
      error: err?.message || 'Ad failed to load',
      description: err?.description,
    };
  }
}

/**
 * Check if an ad is currently available to show.
 * Returns false if SDK not loaded.
 */
export function isAdAvailable(): boolean {
  return controller !== null && window.Adsgram !== undefined;
}
