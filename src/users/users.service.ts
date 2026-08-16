import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { parseGithubUsername } from './utils/github-username';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getProfile(userId: string) {
    return this.userModel.findById(userId).select('-password -refreshTokenHash').lean();
  }

  async getById(userId: string) {
    return this.userModel.findById(userId).select('-password -refreshTokenHash').lean();
  }

  async getByIds(userIds: string[]) {
    if (userIds.length === 0) return [];
    return this.userModel
      .find({ _id: { $in: userIds } })
      .select('-password -refreshTokenHash')
      .lean();
  }

  async getFollowers(userId: string) {
    const user = await this.getById(userId);
    if (!user) throw new NotFoundException('User not found');
    const ids = user.followers ?? [];
    if (ids.length === 0) return [];
    return this.userModel
      .find({ _id: { $in: ids } })
      .select('-password -refreshTokenHash')
      .lean();
  }

  async getFollowing(userId: string) {
    const user = await this.getById(userId);
    if (!user) throw new NotFoundException('User not found');
    const ids = user.following ?? [];
    if (ids.length === 0) return [];
    return this.userModel
      .find({ _id: { $in: ids } })
      .select('-password -refreshTokenHash')
      .lean();
  }

  async listUsers(excludeId?: string) {
    const query = excludeId ? { _id: { $ne: excludeId } } : {};
    return this.userModel.find(query).select('-password -refreshTokenHash').limit(50).lean();
  }

  async searchUsers(excludeId: string | undefined, rawQuery: string, limit = 10) {
    const q = this.normalizeSearchQuery(rawQuery);
    if (!q) return [];
    const safeLimit = Math.max(1, Math.min(limit, 25));
    const regex = new RegExp(this.escapeRegex(q), 'i');
    const baseFilter: Record<string, unknown> = {
      $or: [{ displayName: regex }, { email: regex }, { branch: regex }, { college: regex }],
    };
    if (excludeId) baseFilter._id = { $ne: excludeId };
    return this.userModel
      .find(baseFilter)
      .select('-password -refreshTokenHash')
      .limit(safeLimit)
      .lean();
  }

  async updateProfile(userId: string, payload: UpdateProfileDto) {
    const update: Record<string, unknown> = { ...payload };

    if (payload.githubUsername !== undefined) {
      const raw = payload.githubUsername.trim();
      if (!raw) {
        update.githubUsername = '';
      } else {
        const parsed = parseGithubUsername(raw);
        if (!parsed) {
          throw new BadRequestException('Invalid GitHub profile URL or username');
        }
        update.githubUsername = parsed;
      }
    }

    await this.userModel.updateOne({ _id: userId }, { $set: update });
    return this.getById(userId);
  }

  async toggleFollow(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const me = await this.userModel.findById(currentUserId).lean();
    if (!me) return { following: false, followsYou: false };
    const targetUser = await this.userModel.findById(targetUserId).lean();
    if (!targetUser) throw new NotFoundException('User not found');

    const already = me.following?.includes(targetUserId);
    if (already) {
      await this.userModel.updateOne(
        { _id: currentUserId },
        { $pull: { following: targetUserId } },
      );
      await this.userModel.updateOne(
        { _id: targetUserId },
        { $pull: { followers: currentUserId } },
      );
      await this.notificationsService.create(
        targetUserId,
        currentUserId,
        me.displayName,
        'unfollow',
      );
      return {
        following: false,
        followsYou: targetUser.following?.includes(currentUserId) ?? false,
      };
    }

    const isFollowBack = targetUser.following?.includes(currentUserId);
    await this.userModel.updateOne(
      { _id: currentUserId },
      { $addToSet: { following: targetUserId } },
    );
    await this.userModel.updateOne(
      { _id: targetUserId },
      { $addToSet: { followers: currentUserId } },
    );
    await this.notificationsService.create(
      targetUserId,
      currentUserId,
      me.displayName,
      isFollowBack ? 'follow_accept' : 'follow',
    );
    if (targetUser.emailNotificationsEnabled) {
      await this.emailService.sendNewFollowerEmail(
        targetUser.email,
        targetUser.displayName,
        me.displayName,
        currentUserId,
      );
    }
    return {
      following: true,
      followsYou: isFollowBack,
    };
  }

  private normalizeSearchQuery(raw: string) {
    return raw.trim().replace(/\s+/g, ' ').slice(0, 80);
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
