/** DevTweetHub email brand — mirrors frontend `tokens.css` / `site.ts`. */
export const brand = {
  name: 'DevTweetHub',
  tagline: 'Where developers connect',
  primary: '#0abab5',
  primaryHover: '#099e9a',
  primaryDeep: '#067a77',
  text: '#111b21',
  textMuted: '#6b7280',
  textSubtle: '#64748b',
  surface: '#ffffff',
  background: '#f4f7f7',
  border: '#e5e7eb',
  accentBg: '#ecfafa',
  radius: '12px',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function preheaderBlock(text: string) {
  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
      ${escapeHtml(text)}
    </div>`;
}

function logoMark() {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0">
      <tr>
        <td style="vertical-align:middle;padding-right:12px;">
          <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.2);text-align:center;line-height:40px;font-size:22px;font-weight:700;color:#ffffff;">
            D
          </div>
        </td>
        <td style="vertical-align:middle;">
          <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;line-height:1.2;">
            ${brand.name}
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,0.88);margin-top:2px;">
            ${brand.tagline}
          </div>
        </td>
      </tr>
    </table>`;
}

export function emailHeading(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;line-height:1.3;color:${brand.text};letter-spacing:-0.02em;">${text}</h1>`;
}

export function emailParagraph(text: string, options?: { muted?: boolean; margin?: string }) {
  const color = options?.muted ? brand.textMuted : brand.text;
  const margin = options?.margin ?? '0 0 16px';
  return `<p style="margin:${margin};font-size:15px;line-height:1.6;color:${color};">${text}</p>`;
}

export function emailMuted(text: string) {
  return `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${brand.textSubtle};">${text}</p>`;
}

export function emailButton(href: string, label: string) {
  // Only escape quotes for HTML attributes — do not entity-encode URL characters.
  const safeHref = href.replace(/"/g, '&quot;');
  const safeLabel = escapeHtml(label);
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:20px 0 4px;">
      <tr>
        <td style="border-radius:${brand.radius};background:${brand.primary};">
          <a href="${safeHref}" target="_blank" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:${brand.radius};">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>`;
}

export function emailSecondaryLink(href: string) {
  const safeHrefAttr = href.replace(/"/g, '&quot;');
  const safeHrefText = escapeHtml(href);
  return emailMuted(
    `If the button doesn&apos;t work, copy and paste this link into your browser:<br/>
    <a href="${safeHrefAttr}" style="color:${brand.primary};word-break:break-all;">${safeHrefText}</a>`,
  );
}

export function emailDivider() {
  return `<hr style="border:none;border-top:1px solid ${brand.border};margin:24px 0;" />`;
}

export function emailFeatureList(items: string[]) {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:0 0 10px;vertical-align:top;width:22px;font-size:15px;line-height:1.5;color:${brand.primary};">&#10003;</td>
          <td style="padding:0 0 10px;font-size:15px;line-height:1.5;color:${brand.text};">${escapeHtml(item)}</td>
        </tr>`,
    )
    .join('');
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 4px;">
      ${rows}
    </table>`;
}

export function emailStatGrid(stats: { label: string; value: number }[]) {
  const cells = stats
    .map(
      (stat, index) => `
        <td style="width:${Math.floor(100 / stats.length)}%;padding:${index > 0 ? '0 0 0 8px' : '0'};vertical-align:top;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brand.accentBg};border-radius:${brand.radius};border:1px solid ${brand.border};">
            <tr>
              <td style="padding:16px;text-align:center;">
                <div style="font-size:28px;font-weight:700;color:${brand.primary};line-height:1;">${stat.value}</div>
                <div style="font-size:12px;color:${brand.textMuted};margin-top:6px;line-height:1.3;">${escapeHtml(stat.label)}</div>
              </td>
            </tr>
          </table>
        </td>`,
    )
    .join('');
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 4px;">
      <tr>${cells}</tr>
    </table>`;
}

export function emailHighlightBox(content: string) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;">
      <tr>
        <td style="padding:14px 16px;background:${brand.accentBg};border-left:4px solid ${brand.primary};border-radius:0 ${brand.radius} ${brand.radius} 0;font-size:14px;line-height:1.55;color:${brand.text};">
          ${content}
        </td>
      </tr>
    </table>`;
}

export function emailLayout(options: {
  title: string;
  preheader?: string;
  body: string;
}) {
  const { title, preheader, body } = options;
  const year = new Date().getFullYear();

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${brand.background};font-family:${brand.fontFamily};color:${brand.text};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
    ${preheader ? preheaderBlock(preheader) : ''}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brand.background};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:${brand.surface};border-radius:16px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(17,27,33,0.06);">
            <tr>
              <td style="padding:28px 28px 24px;background:${brand.primary};background-image:linear-gradient(135deg, ${brand.primary} 0%, ${brand.primaryHover} 55%, ${brand.primaryDeep} 100%);">
                ${logoMark()}
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 28px;">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 24px;border-top:1px solid ${brand.border};background:#fafbfb;">
                <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${brand.textSubtle};">
                  You&apos;re receiving this because you have a ${brand.name} account.
                </p>
                <p style="margin:0;font-size:12px;line-height:1.5;color:${brand.textSubtle};">
                  &copy; ${year} ${brand.name}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
