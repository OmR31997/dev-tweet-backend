import { BadRequestException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EmailService } from '../email/email.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { normalizeResetToken } from './utils/reset-token';
import { createHash } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(payload: RegisterDto) {
    const exists = await this.userModel.findOne({ email: payload.email.toLowerCase() });
    if (exists) {
      throw new BadRequestException('Email already registered');
    }

    const password = await bcrypt.hash(payload.password, 10);
    const user = await this.userModel.create({
      email: payload.email.toLowerCase(),
      password,
      displayName: payload.displayName,
    });

    const session = await this.createSession(user);
    // Fire-and-forget — don't block the signup response on the email provider.
    void this.emailService
      .sendWelcomeEmail(user.email, user.displayName)
      .catch(() => undefined);
    return session;
  }

  async login(payload: LoginDto) {
    const user = await this.userModel.findOne({ email: payload.email.toLowerCase() });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isValid = await bcrypt.compare(payload.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.createSession(user);
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.userModel.findById(payload.sub);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const valid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.createSession(user);
  }

  async logout(userId: string) {
    await this.userModel.updateOne({ _id: userId }, { $set: { refreshTokenHash: null } });
    return { ok: true };
  }

  async forgotPassword(payload: ForgotPasswordDto) {
    const email = payload.email.toLowerCase();
    this.logger.log(`Password reset requested for ${email}`);

    if (!this.emailService.isConfigured()) {
      throw new ServiceUnavailableException(
        'Password reset email is not available right now. Please try again later.',
      );
    }

    const user = await this.userModel.findOne({ email });
    if (!user) {
      this.logger.log(`Password reset: no account found for ${email}`);
      return { ok: true };
    }

    const { rawToken, tokenHash } = this.emailService.createPasswordResetToken();
    await this.userModel.updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordTokenHash: tokenHash,
          resetPasswordExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      },
    );

    const resetUrl = this.emailService.buildPasswordResetUrl(rawToken);
    const emailResult = await this.emailService.sendForgotPasswordEmail(
      user.email,
      user.displayName,
      rawToken,
    );

    if (!emailResult.ok) {
      this.logger.warn(
        `Password-reset email failed for ${user.email}: ${emailResult.reason ?? emailResult.status}`,
      );
      if (this.configService.get<string>('NODE_ENV', 'development') !== 'production') {
        this.logger.warn(`[dev] Password reset link for ${user.email}:\n${resetUrl}`);
      }
    } else {
      this.logger.log(`Password reset email sent to ${user.email}`);
    }

    return { ok: true };
  }

  async resetPassword(payload: ResetPasswordDto) {
    const token = normalizeResetToken(payload.token);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const user = await this.userModel.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
    });
    if (!user) {
      this.logger.warn('Password reset rejected: token not found or expired');
      throw new BadRequestException('Invalid or expired reset token');
    }
    const passwordHash = await bcrypt.hash(payload.newPassword, 10);
    await this.userModel.updateOne(
      { _id: user._id },
      {
        $set: {
          password: passwordHash,
          resetPasswordTokenHash: null,
          resetPasswordExpiresAt: null,
          refreshTokenHash: null,
        },
      },
    );
    await this.emailService.sendPasswordChangedEmail(user.email, user.displayName);
    return { ok: true };
  }

  private async createSession(user: UserDocument) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
      },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
        expiresIn:
          Number.parseInt(
            this.configService.get<string>(
              'JWT_REFRESH_TTL_SECONDS',
              String(7 * 24 * 60 * 60),
            ),
            10,
          ) || 7 * 24 * 60 * 60,
      },
    );
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.userModel.updateOne({ _id: user.id }, { $set: { refreshTokenHash } });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      },
    };
  }
}
