const MESSAGES = {
  network: 'We could not reach the server. Check your connection and try again.',
  access: 'You do not have access to this. Sign in again or ask your admin for access.',
  missing: 'We could not find what you were looking for.',
  fallback: 'Something went wrong. Please try again.',
};

const CODE_MESSAGES = {
  NETWORK: MESSAGES.network,
  ACCESS: MESSAGES.access,
  MISSING: MESSAGES.missing,
};

const MESSAGE_PATTERNS = [
  [/network|failed to fetch|fetch failed|offline|connection|econnrefused|timeout|timed out/i, MESSAGES.network],
  [/forbidden|unauthori[sz]ed|access denied|not allowed|permission|401|403|sign in again/i, MESSAGES.access],
  [/not found|does not exist|no longer available|404|missing/i, MESSAGES.missing],
];

function describe(error) {
  if (typeof error === 'string') return { message: error, code: '', detail: '' };
  if (!error || typeof error !== 'object') return { message: '', code: '', detail: '' };
  const detail = typeof error.detail === 'string' ? error.detail.trim() : '';
  return {
    message: typeof error.message === 'string' ? error.message : '',
    code: typeof error.code === 'string' ? error.code : '',
    detail,
  };
}

/** Turns a server status into a code the friendly map understands. */
export function errorCodeForStatus(status) {
  if (status === 401 || status === 403) return 'ACCESS';
  if (status === 404) return 'MISSING';
  return '';
}

/**
 * Returns text that is safe to show to a user. Raw messages stay in the console.
 * A code supplied by an action wins, then known message patterns, then the fallback.
 */
export function friendlyError(error, fallbackText) {
  const { message, code, detail } = describe(error);
  const fallback =
    typeof fallbackText === 'string' && fallbackText.trim() ? fallbackText : MESSAGES.fallback;

  let text = CODE_MESSAGES[code];
  if (!text) {
    const match = MESSAGE_PATTERNS.find(([pattern]) => pattern.test(message));
    text = match ? match[1] : '';
  }
  if (!text) return fallback;
  return detail ? `${text} ${detail}` : text;
}

export { MESSAGES as ERROR_MESSAGES };
