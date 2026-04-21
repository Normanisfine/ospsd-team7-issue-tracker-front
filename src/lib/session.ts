/**
 * Small wrapper around localStorage for the Trello session token.
 *
 * The backend issues an opaque `session_token` after OAuth callback; we
 * keep it on the client and send it as `X-Session-Token` on every
 * subsequent API request. Not a JWT and not tied to the user — simple
 * on purpose.
 */

const KEY = "ospsd_session_token";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, token);
}

export function clearSessionToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
