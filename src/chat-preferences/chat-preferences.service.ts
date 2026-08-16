import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ChatPreference,
  ChatPreferenceDocument,
} from './schemas/chat-preference.schema';

@Injectable()
export class ChatPreferencesService {
  constructor(
    @InjectModel(ChatPreference.name)
    private readonly preferenceModel: Model<ChatPreferenceDocument>,
  ) {}

  async getArchivedGroupIds(userId: string): Promise<string[]> {
    const rows = await this.preferenceModel
      .find({
        userId,
        chatType: 'group',
        archivedAt: { $exists: true, $ne: null },
      })
      .select('conversationId')
      .lean();
    return rows
      .map((row) => row.conversationId)
      .filter((id): id is string => Boolean(id));
  }

  async getArchivedPeerIds(userId: string): Promise<string[]> {
    const rows = await this.preferenceModel
      .find({
        userId,
        chatType: 'dm',
        archivedAt: { $exists: true, $ne: null },
      })
      .select('peerUserId')
      .lean();
    return rows
      .map((row) => row.peerUserId)
      .filter((id): id is string => Boolean(id));
  }

  async archiveGroup(userId: string, conversationId: string) {
    await this.preferenceModel.findOneAndUpdate(
      { userId, chatType: 'group', conversationId },
      { $set: { archivedAt: new Date() } },
      { upsert: true, new: true },
    );
    return { ok: true };
  }

  async unarchiveGroup(userId: string, conversationId: string) {
    await this.preferenceModel.updateOne(
      { userId, chatType: 'group', conversationId },
      { $unset: { archivedAt: '' } },
    );
    return { ok: true };
  }

  async archiveDm(userId: string, peerUserId: string) {
    await this.preferenceModel.findOneAndUpdate(
      { userId, chatType: 'dm', peerUserId },
      { $set: { archivedAt: new Date() } },
      { upsert: true, new: true },
    );
    return { ok: true };
  }

  async unarchiveDm(userId: string, peerUserId: string) {
    await this.preferenceModel.updateOne(
      { userId, chatType: 'dm', peerUserId },
      { $unset: { archivedAt: '' } },
    );
    return { ok: true };
  }

  async archivedCounts(userId: string) {
    const [groups, dms] = await Promise.all([
      this.preferenceModel.countDocuments({
        userId,
        chatType: 'group',
        archivedAt: { $exists: true, $ne: null },
      }),
      this.preferenceModel.countDocuments({
        userId,
        chatType: 'dm',
        archivedAt: { $exists: true, $ne: null },
      }),
    ]);
    return { groups, dms, total: groups + dms };
  }

  async getDmClearedAt(userId: string, peerUserId: string) {
    const row = await this.preferenceModel
      .findOne({ userId, chatType: 'dm', peerUserId })
      .select('clearedAt')
      .lean();
    return row?.clearedAt ?? null;
  }

  async getDmClearedAtMap(userId: string, peerUserIds: string[]) {
    if (peerUserIds.length === 0) return new Map<string, Date | null>();
    const rows = await this.preferenceModel
      .find({ userId, chatType: 'dm', peerUserId: { $in: peerUserIds } })
      .select('peerUserId clearedAt')
      .lean();
    return new Map(
      rows.map((row) => [String(row.peerUserId), row.clearedAt ?? null]),
    );
  }

  async getGroupClearedAt(userId: string, conversationId: string) {
    const row = await this.preferenceModel
      .findOne({ userId, chatType: 'group', conversationId })
      .select('clearedAt')
      .lean();
    return row?.clearedAt ?? null;
  }

  async clearDmChat(userId: string, peerUserId: string) {
    await this.preferenceModel.findOneAndUpdate(
      { userId, chatType: 'dm', peerUserId },
      { $set: { clearedAt: new Date() } },
      { upsert: true, new: true },
    );
    return { ok: true };
  }

  async clearGroupChat(userId: string, conversationId: string) {
    await this.preferenceModel.findOneAndUpdate(
      { userId, chatType: 'group', conversationId },
      { $set: { clearedAt: new Date() } },
      { upsert: true, new: true },
    );
    return { ok: true };
  }
}
