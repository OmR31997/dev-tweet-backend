/**
 * Parse CLIENT_ORIGIN (comma-separated browser origins allowed by CORS / WebSockets).
 */
export function parseClientOrigins(raw?: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Read CLIENT_ORIGIN at bootstrap (HTTP CORS, WebSocket gateway decorator). */
export function getClientOriginsFromEnv(): string[] {
  return parseClientOrigins(process.env.CLIENT_ORIGIN);
}
