/**
 * Gestionnaire global passif pour la détection de quota Firestore/API dépassé.
 * Aucune requête serveur inutile n'est effectuée.
 */

let quotaExceededState = false;
const QUOTA_EVENT_NAME = 'firestore_quota_exceeded';

export function isQuotaExhausted(): boolean {
  return quotaExceededState;
}

export function triggerQuotaExceededNotice(): void {
  if (!quotaExceededState) {
    quotaExceededState = true;
  }
  window.dispatchEvent(new CustomEvent(QUOTA_EVENT_NAME));
}

export function resetQuotaNotice(): void {
  quotaExceededState = false;
}

export function subscribeToQuotaExceeded(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener(QUOTA_EVENT_NAME, handler);
  if (quotaExceededState) {
    callback();
  }
  return () => window.removeEventListener(QUOTA_EVENT_NAME, handler);
}

// Intercepteur global d'erreurs JS non capturées et rejets de promesses
if (typeof window !== 'undefined') {
  const checkErrorMsg = (msg: string) => {
    if (!msg) return;
    const lower = msg.toLowerCase();
    if (
      lower.includes('resource_exhausted') ||
      lower.includes('quota limit exceeded') ||
      lower.includes('resource-exhausted') ||
      lower.includes('free daily write units')
    ) {
      triggerQuotaExceededNotice();
    }
  };

  window.addEventListener('error', (event) => {
    checkErrorMsg(event?.message || String(event?.error));
  });

  window.addEventListener('unhandledrejection', (event) => {
    checkErrorMsg(event?.reason?.message || String(event?.reason));
  });
}
