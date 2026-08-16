import {
  brand,
  emailButton,
  emailDivider,
  emailFeatureList,
  emailHeading,
  emailHighlightBox,
  emailLayout,
  emailMuted,
  emailParagraph,
  emailSecondaryLink,
  emailStatGrid,
  escapeHtml,
} from './theme';

type DigestStats = {
  newFollowers: number;
  newLikes: number;
  unread: number;
};

export function welcomeTemplate(displayName: string, appUrl: string) {
  const safeName = escapeHtml(displayName);
  const feedUrl = `${appUrl.replace(/\/$/, '')}/feed`;

  return emailLayout({
    title: `Welcome to ${brand.name}`,
    preheader: `Your developer community account is ready — start posting and messaging.`,
    body: `
      ${emailHeading(`Welcome, ${safeName}!`)}
      ${emailParagraph(
        `Your account is live. Share updates, follow peers, and message your cohort — all in one calm developer feed.`,
      )}
      ${emailFeatureList([
        'Post snippets, links, and build updates',
        'Follow developers and grow your network',
        'Send direct messages and group chats',
      ])}
      ${emailButton(feedUrl, 'Open your feed')}
      ${emailMuted(`Need help? Just reply to this email or visit ${escapeHtml(appUrl)}.`)}
    `,
  });
}

export function forgotPasswordTemplate(displayName: string, resetUrl: string) {
  const safeName = escapeHtml(displayName);

  return emailLayout({
    title: 'Reset your password',
    preheader: 'Use this link to choose a new password. It expires in 30 minutes.',
    body: `
      ${emailHeading('Reset your password')}
      ${emailParagraph(`Hi ${safeName}, we received a request to reset the password for your ${brand.name} account.`)}
      ${emailButton(resetUrl, 'Reset password')}
      ${emailMuted('This link expires in <strong>30 minutes</strong> and can only be used once.')}
      ${emailSecondaryLink(resetUrl)}
      ${emailDivider()}
      ${emailHighlightBox(
        `<strong>Didn&apos;t request this?</strong> You can safely ignore this email — your password won&apos;t change unless you use the link above.`,
      )}
    `,
  });
}

export function passwordChangedTemplate(displayName: string, appUrl: string) {
  const safeName = escapeHtml(displayName);
  const loginUrl = `${appUrl.replace(/\/$/, '')}/login`;

  return emailLayout({
    title: 'Password changed',
    preheader: 'Your DevTweetHub password was updated successfully.',
    body: `
      ${emailHeading('Password updated')}
      ${emailParagraph(`Hi ${safeName}, your ${brand.name} password was changed successfully.`)}
      ${emailParagraph(
        'If you made this change, no further action is needed. You can sign in with your new password anytime.',
        { muted: true },
      )}
      ${emailButton(loginUrl, 'Sign in')}
      ${emailDivider()}
      ${emailHighlightBox(
        `<strong>Wasn&apos;t you?</strong> Reset your password immediately and review your account security.`,
      )}
    `,
  });
}

export function newFollowerTemplate(
  displayName: string,
  followerName: string,
  profileUrl: string,
) {
  const safeName = escapeHtml(displayName);
  const safeFollower = escapeHtml(followerName);

  return emailLayout({
    title: 'You have a new follower',
    preheader: `${followerName} started following you on DevTweetHub.`,
    body: `
      ${emailHeading('New follower')}
      ${emailParagraph(`Hi ${safeName}, <strong>${safeFollower}</strong> started following you on ${brand.name}.`)}
      ${emailParagraph('Check out their profile and say hello.', { muted: true, margin: '0 0 20px' })}
      ${emailButton(profileUrl, 'View profile')}
    `,
  });
}

export function dailyDigestTemplate(displayName: string, stats: DigestStats, appUrl: string) {
  const safeName = escapeHtml(displayName);
  const notificationsUrl = `${appUrl.replace(/\/$/, '')}/notifications`;
  const totalActivity = stats.newFollowers + stats.newLikes;

  return emailLayout({
    title: `Your daily ${brand.name} digest`,
    preheader: `${stats.newFollowers} new followers, ${stats.newLikes} new likes, ${stats.unread} unread notifications.`,
    body: `
      ${emailHeading(`Good morning, ${safeName}`)}
      ${emailParagraph(
        totalActivity > 0
          ? `Here&apos;s what happened in your network over the last 24 hours.`
          : `It&apos;s been a quiet day — here&apos;s your notification snapshot.`,
        { margin: '0 0 8px' },
      )}
      ${emailStatGrid([
        { label: 'New followers', value: stats.newFollowers },
        { label: 'New likes', value: stats.newLikes },
        { label: 'Unread', value: stats.unread },
      ])}
      ${emailButton(notificationsUrl, 'View notifications')}
      ${emailMuted('You can turn off daily digests anytime in Settings.')}
    `,
  });
}
