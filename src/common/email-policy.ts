import { addCustomDomains, isValid } from 'mailchecker';

/** Reserved / placeholder domains that are not real inboxes. */
const BLOCKED_SIGNUP_DOMAINS = [
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'test.test',
  'localhost',
  'invalid',
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'yopmail.com',
  'throwaway.email',
  'getnada.com',
  'sharklasers.com',
  'trashmail.com',
];

addCustomDomains(BLOCKED_SIGNUP_DOMAINS);

export function normalizeSignupEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedSignupEmail(email: string): boolean {
  const normalized = normalizeSignupEmail(email);
  if (!normalized || !normalized.includes('@')) {
    return false;
  }
  return isValid(normalized);
}

export const SIGNUP_EMAIL_REJECTED_MESSAGE =
  'Please use a real, permanent email address. Temporary or disposable emails are not allowed.';
