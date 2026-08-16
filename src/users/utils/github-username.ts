const GITHUB_USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/** Normalize a GitHub profile URL or @handle into a username. */
export function parseGithubUsername(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let candidate = raw;
  if (candidate.startsWith('@')) {
    candidate = candidate.slice(1);
  }

  try {
    if (/^https?:\/\//i.test(candidate)) {
      const url = new URL(candidate);
      if (!/^(?:www\.)?github\.com$/i.test(url.hostname)) return null;
      const segment = url.pathname.split('/').filter(Boolean)[0];
      if (!segment) return null;
      candidate = segment;
    }
  } catch {
    return null;
  }

  candidate = candidate.replace(/\/$/, '');
  if (!GITHUB_USERNAME_RE.test(candidate)) return null;
  return candidate;
}
