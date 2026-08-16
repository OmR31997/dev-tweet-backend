import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from '../messages/schemas/message.schema';
import {
  Conversation,
  ConversationDocument,
} from '../conversations/schemas/conversation.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RealtimeService } from './realtime.service';

export type PresenceSnapshot = {
  userId: string;
  online: boolean;
  lastSeenAt: string | null;
};

@Injectable()
export class PresenceService {
  private readonly connections = new Map<string, number>();

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly realtime: RealtimeService,
  ) {}

  isOnline(userId: string) {
    return (this.connections.get(userId) ?? 0) > 0;
  }

  async handleConnect(userId: string) {
    const previous = this.connections.get(userId) ?? 0;
    this.connections.set(userId, previous + 1);

    if (previous === 0) {
      await this.broadcastPresence(userId, true);
    }
    await this.syncPeersPresence(userId);
  }

  async handleDisconnect(userId: string) {
    const current = this.connections.get(userId) ?? 0;
    if (current <= 1) {
      this.connections.delete(userId);
      const lastSeenAt = new Date();
      await this.userModel.updateOne(
        { _id: userId },
        { $set: { lastSeenAt } },
      );
      await this.broadcastPresence(userId, false, lastSeenAt);
      return;
    }
    this.connections.set(userId, current - 1);
  }

  async getPresence(userId: string): Promise<PresenceSnapshot> {
    const user = await this.userModel
      .findById(userId)
      .select('lastSeenAt')
      .lean();
    return {
      userId,
      online: this.isOnline(userId),
      lastSeenAt: user?.lastSeenAt
        ? new Date(user.lastSeenAt).toISOString()
        : null,
    };
  }

  async getPresenceBulk(userIds: string[]): Promise<PresenceSnapshot[]> {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) return [];
    const users = await this.userModel
      .find({ _id: { $in: unique } })
      .select('lastSeenAt')
      .lean();
    const lastSeenById = new Map(
      users.map((user) => [
        String(user._id),
        user.lastSeenAt ? new Date(user.lastSeenAt).toISOString() : null,
      ]),
    );
    return unique.map((userId) => ({
      userId,
      online: this.isOnline(userId),
      lastSeenAt: lastSeenById.get(userId) ?? null,
    }));
  }

  private async broadcastPresence(
    userId: string,
    online: boolean,
    lastSeenAt?: Date,
  ) {
    const peers = await this.getPeerIds(userId);
    const payload = {
      userId,
      online,
      lastSeenAt: lastSeenAt?.toISOString() ?? null,
    };
    const event = online ? 'presence.online' : 'presence.offline';
    for (const peerId of peers) {
      this.realtime.emitToUser(peerId, event, payload);
    }
  }

  private async syncPeersPresence(userId: string) {
    const peers = await this.getPeerIds(userId);
    if (peers.length === 0) return;
    const users = await this.getPresenceBulk(peers);
    this.realtime.emitToUser(userId, 'presence.sync', { users });
  }

  private async getPeerIds(userId: string): Promise<string[]> {
    const [sentTo, receivedFrom, groups] = await Promise.all([
      this.messageModel.distinct('recipientId', {
        senderId: userId,
        recipientId: { $ne: null },
      }),
      this.messageModel.distinct('senderId', { recipientId: userId }),
      this.conversationModel
        .find({ participants: userId, type: 'group' })
        .select('participants')
        .lean(),
    ]);

    const groupPeers = groups.flatMap((group) =>
      group.participants.filter((id) => id !== userId),
    );

    return [
      ...new Set([
        ...sentTo.map(String),
        ...receivedFrom.map(String),
        ...groupPeers,
      ]),
    ];
  }
}
