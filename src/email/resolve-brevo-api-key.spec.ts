import { resolveBrevoApiKey } from './resolve-brevo-api-key';

describe('resolveBrevoApiKey', () => {
  const plain = 'xkeysib-test-key-abc';

  it('returns plain xkeysib keys unchanged', () => {
    expect(resolveBrevoApiKey(plain)).toBe(plain);
  });

  it('extracts key from JSON string', () => {
    expect(resolveBrevoApiKey(JSON.stringify({ api_key: plain }))).toBe(plain);
  });

  it('extracts key from base64 JSON wrapper', () => {
    const wrapped = Buffer.from(JSON.stringify({ api_key: plain }), 'utf8').toString('base64');
    expect(resolveBrevoApiKey(wrapped)).toBe(plain);
  });

  it('returns undefined for empty input', () => {
    expect(resolveBrevoApiKey(undefined)).toBeUndefined();
    expect(resolveBrevoApiKey('  ')).toBeUndefined();
  });
});
