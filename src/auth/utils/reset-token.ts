/** Normalize a reset token from query strings, emails, or copy-paste. */
export function normalizeResetToken(value: string): string {
  let token = value.trim();
  if (!token) {
    return token;
  }

  try {
    let decoded = decodeURIComponent(token);
    while (decoded !== token && decoded.includes('%')) {
      token = decoded;
      decoded = decodeURIComponent(token);
    }
    token = decoded;
  } catch {
    // Keep the trimmed raw value when decoding fails.
  }

  return token;
}
