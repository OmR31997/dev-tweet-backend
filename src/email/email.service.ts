import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomBytes } from 'crypto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Notification, NotificationDocument } from '../notifications/schemas/notification.schema';
import {
  dailyDigestTemplate,
  forgotPasswordTemplate,
  newFollowerTemplate,
  passwordChangedTemplate,
  welcomeTemplate,
} from './templates/messages';
import { resolveBrevoApiKey } from './resolve-brevo-api-key';
import { getAppUrl } from '../config/app-url';

type EmailSendResult =
  | { ok: true }
  | { ok: false; reason: string; status?: number; body?: string };

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly brandName = 'DevTweetHub';

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  onModuleInit() {
    if (this.isConfigured()) {
      this.logger.log('Transactional email provider configured (Brevo).');
      return;
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production') {
      this.logger.error(
        'Email provider is NOT configured. Set BREVO_API_KEY (or BRAVO_MCP_API_KEY) and EMAIL_FROM in production — password reset and welcome emails will fail.',
      );
      return;
    }

    this.logger.warn(
      'Email provider not configured — set BREVO_API_KEY in .env. Password-reset links will be logged to the console in development.',
    );
  }

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  private getApiKey(): string | undefined {
    const raw =
      this.configService.get<string>('BREVO_API_KEY') ??
      this.configService.get<string>('BRAVO_MCP_API_KEY');
    return resolveBrevoApiKey(raw);
  }

  private getApiUrl(): string {
    return (
      this.configService.get<string>('BREVO_API_URL') ??
      this.configService.get<string>('BRAVO_MCP_API_URL') ??
      'https://api.brevo.com/v3/smtp/email'
    );
  }

  private getAppUrl(): string {
    return getAppUrl(this.configService);
  }

  private getPasswordResetBaseUrl(): string {
    const explicit = this.configService.get<string>('PASSWORD_RESET_URL');
    if (explicit?.trim()) {
      return explicit.trim().replace(/\/$/, '');
    }
    return `${this.getAppUrl().replace(/\/$/, '')}/reset-password`;
  }

  buildPasswordResetUrl(rawToken: string): string {
    return `${this.getPasswordResetBaseUrl()}?token=${encodeURIComponent(rawToken)}`;
  }

  async sendWelcomeEmail(email: string, displayName: string) {
    return this.sendEmail(
      email,
      `Welcome to ${this.brandName}`,
      welcomeTemplate(displayName, this.getAppUrl()),
    );
  }

  async sendForgotPasswordEmail(email: string, displayName: string, rawToken: string) {
    const resetUrl = this.buildPasswordResetUrl(rawToken);
    const result = await this.sendEmail(
      email,
      'Reset your DevTweetHub password',
      forgotPasswordTemplate(displayName, resetUrl),
    );

    if (!result.ok && result.reason === 'missing_api_key') {
      this.logDevPasswordResetLink(email, resetUrl);
    }

    return result;
  }

  async sendPasswordChangedEmail(email: string, displayName: string) {
    return this.sendEmail(
      email,
      'Your DevTweetHub password was changed',
      passwordChangedTemplate(displayName, this.getAppUrl()),
    );
  }

  async sendNewFollowerEmail(
    email: string,
    displayName: string,
    followerName: string,
    followerId?: string,
  ) {
    const profileUrl = followerId
      ? `${this.getAppUrl().replace(/\/$/, '')}/profile/${followerId}`
      : `${this.getAppUrl().replace(/\/$/, '')}/notifications`;

    return this.sendEmail(
      email,
      `${followerName} started following you`,
      newFollowerTemplate(displayName, followerName, profileUrl),
    );
  }

  createPasswordResetToken() {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    return { rawToken, tokenHash };
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDailyDigests() {
    if (!this.isConfigured()) return;

    const users = await this.userModel
      .find({ dailyDigestEnabled: true, emailNotificationsEnabled: true })
      .select('email displayName')
      .lean();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const user of users) {
      const [newFollowers, newLikes, unread] = await Promise.all([
        this.notificationModel.countDocuments({
          recipientId: user._id.toString(),
          type: 'follow',
          createdAt: { $gte: since },
        }),
        this.notificationModel.countDocuments({
          recipientId: user._id.toString(),
          type: 'like',
          createdAt: { $gte: since },
        }),
        this.notificationModel.countDocuments({
          recipientId: user._id.toString(),
          read: false,
        }),
      ]);
      const summary = {
        newFollowers,
        newLikes,
        unread,
      };
      await this.sendEmail(
        user.email,
        `Your daily ${this.brandName} digest`,
        dailyDigestTemplate(user.displayName, summary, this.getAppUrl()),
      );
    }
  }

  private logDevPasswordResetLink(email: string, resetUrl: string) {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production') return;

    this.logger.warn(
      `[dev] BREVO_API_KEY not set — password reset link for ${email}:\n${resetUrl}`,
    );
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<EmailSendResult> {
    const apiKey = this.getApiKey();
    const apiUrl = this.getApiUrl();
    const from = this.configService.get<string>('EMAIL_FROM', 'no-reply@devtweethub.com');
    const senderName = this.configService.get<string>('EMAIL_FROM_NAME', this.brandName);

    if (!apiKey) {
      this.logger.warn(`BREVO_API_KEY missing. Skipping email "${subject}" to ${to}`);
      return { ok: false, reason: 'missing_api_key' };
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          sender: { email: from, name: senderName },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        let hint =
          'Check BREVO_API_KEY, EMAIL_FROM (verified sender in Brevo), and sender domain.';
        try {
          const body = JSON.parse(text) as { message?: string };
          if (body.message?.includes('unrecognised IP') || body.message?.includes('IP address')) {
            hint =
              'Brevo blocked this server IP. Disable IP restriction or add your IP at https://app.brevo.com/security/authorised_ips';
          } else if (body.message) {
            hint = body.message;
          }
        } catch {
          // keep default hint
        }
        this.logger.error(`Email send failed (${response.status}) to ${to}: ${text}. ${hint}`);
        return { ok: false, reason: 'provider_error', status: response.status, body: text };
      }

      this.logger.log(`Email sent: "${subject}" → ${to}`);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Email provider unreachable. Skipping email "${subject}" to ${to}: ${message}`);
      return { ok: false, reason: 'provider_unreachable' };
    }
  }
}
