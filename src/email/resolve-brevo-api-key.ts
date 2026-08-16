/**
 * Brevo API keys are `xkeysib-...` strings. Some setups store a base64 JSON
 * wrapper from MCP tools: {"api_key":"xkeysib-..."}.
 */
export function resolveBrevoApiKey(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;

  if (value.startsWith('xkeysib-')) {
    return value;
  }

  if (value.startsWith('{')) {
    try {
      const parsed = JSON.parse(value) as { api_key?: string; apiKey?: string };
      const nested = parsed.api_key ?? parsed.apiKey;
      if (nested?.startsWith('xkeysib-')) {
        return nested.trim();
      }
    } catch {
      // fall through
    }
  }

  if (value.startsWith('eyJ')) {
    try {
      const decoded = Buffer.from(value, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded) as { api_key?: string; apiKey?: string };
      const nested = parsed.api_key ?? parsed.apiKey;
      if (nested?.startsWith('xkeysib-')) {
        return nested.trim();
      }
    } catch {
      // fall through
    }
  }

  // Last resort — pass through (provider will return a clear 401 if invalid).
  return value;
}
