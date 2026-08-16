import { ConfigService } from '@nestjs/config';
import { parseClientOrigins } from './client-origin';

/**
 * Public web app origin for emails, password-reset links, and link-preview User-Agent.
 * Prefer APP_URL; otherwise the first entry in CLIENT_ORIGIN.
 */
export function getAppUrl(config: ConfigService): string {
  const explicit = config.get<string>('APP_URL')?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const origins = parseClientOrigins(config.get<string>('CLIENT_ORIGIN'));
  const primary = origins[0];
  if (primary) {
    return primary.replace(/\/$/, '');
  }

  return '';
}
