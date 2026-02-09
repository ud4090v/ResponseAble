// Background service worker for xReplAI Chrome extension
// Handles external messages from xrepl.ai website (license key transfer)

const VERCEL_PROXY_URL = 'https://xrepl.app/api';
const ALLOWED_ORIGINS = ['https://xrepl.ai', 'https://www.xrepl.ai'];

/**
 * Listen for messages from xrepl.ai website (externally_connectable).
 * When the website sends a license key after sign-in, validate it
 * and store it in chrome.storage.sync so the extension activates.
 */
chrome.runtime.onMessageExternal.addListener(
  (message, sender, sendResponse) => {
    // Security: only accept messages from our website
    if (!sender.url || !ALLOWED_ORIGINS.some((o) => sender.url.startsWith(o))) {
      sendResponse({ success: false, error: 'Unauthorized origin' });
      return false;
    }

    if (message && message.type === 'LICENSE_KEY_TRANSFER') {
      const { licenseKey, plan } = message;

      if (!licenseKey || typeof licenseKey !== 'string') {
        sendResponse({ success: false, error: 'Invalid license key' });
        return false;
      }

      // Validate the license key via backend before storing
      validateAndStoreLicense(licenseKey, plan)
        .then((result) => sendResponse(result))
        .catch((err) => {
          console.error('License validation failed:', err);
          sendResponse({ success: false, error: 'Validation failed' });
        });

      // Return true to indicate we will send a response asynchronously
      return true;
    }

    sendResponse({ success: false, error: 'Unknown message type' });
    return false;
  }
);

/**
 * Validate a license key via the backend /validate endpoint,
 * then store it in chrome.storage.sync on success.
 */
async function validateAndStoreLicense(licenseKey, plan) {
  try {
    const response = await fetch(`${VERCEL_PROXY_URL}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: licenseKey.trim() }),
    });

    const data = await response.json();

    if (data.valid) {
      const validatedPlan = data.plan || plan || 'free';

      // Store in chrome.storage.sync (same storage the Options page uses)
      await new Promise((resolve, reject) => {
        chrome.storage.sync.set(
          {
            licenseKey: licenseKey.trim(),
            subscriptionPlan: validatedPlan,
          },
          () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          }
        );
      });

      return { success: true, plan: validatedPlan };
    } else {
      return { success: false, error: data.error || 'Invalid license key' };
    }
  } catch (err) {
    console.error('License validation error:', err);
    return { success: false, error: 'Network error during validation' };
  }
}
