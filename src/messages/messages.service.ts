import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { SendMessageDto } from './dto/send-message.dto';
import { ForwardMessagesDto } from './dto/forward-messages.dto';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../events/realtime.service';
import { Conversation, ConversationDocument } from '../conversations/schemas/conversation.schema';
import { ChatPreferencesService } from '../chat-preferences/chat-preferences.service';
import { buildMessageFields, mediaPreviewLabel } from './message-media.util';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly chatPreferences: ChatPreferencesService,
  ) {}

  /**
   * Persist a message and fan it out over realtime. Single source of truth for
   * both the REST controller and the socket gateway, so ticks stay consistent.
   */
  async send(senderId: string, payload: SendMessageDto) {
    const recipientOnline = this.realtime.isUserOnline(payload.recipientId);
    const replyFields = await this.getReplyFields(senderId, payload.replyToId);
    const messageFields = buildMessageFields(payload);
    const message = await this.messageModel.create({
      senderId,
      recipientId: payload.recipientId,
      delivered: recipientOnline,
      read: false,
      ...messageFields,
      ...replyFields,
    });

    const sender = await this.usersService.getById(senderId);
    await this.notificationsService.create(
      payload.recipientId,
      senderId,
      sender?.displayName ?? 'Developer',
      'message',
    );

    const plain = message.toObject();
    await this.chatPreferences.unarchiveDm(senderId, payload.recipientId);
    await this.chatPreferences.unarchiveDm(payload.recipientId, senderId);
    // Deliver to both ends — sender gets the saved doc (replaces optimistic one).
    this.realtime.emitToUser(payload.recipientId, 'dm.received', plain);
    this.realtime.emitToUser(senderId, 'dm.received', plain);
    this.realtime.emitToUser(payload.recipientId, 'notification.created');

    return message;
  }

  /** Mark a message delivered (recipient's socket received it) + notify sender. */
  async markDelivered(messageId: string, recipientId: string) {
    const result = await this.messageModel.updateOne(
      { _id: messageId, recipientId, delivered: { $ne: true } },
      { $set: { delivered: true } },
    );
    if (result.modifiedCount) {
      const message = await this.messageModel.findById(messageId).lean();
      if (message) {
        this.realtime.emitToUser(message.senderId, 'message.delivered', {
          messageId,
        });
      }
    }
    return { ok: true };
  }

  async conversation(userId: string, otherUserId: string) {
    const filter = await this.buildDmMessageFilter(userId, otherUserId);
    return this.messageModel.find(filter).sort({ createdAt: 1 }).lean();
  }

  async clearConversation(userId: string, otherUserId: string) {
    await this.chatPreferences.clearDmChat(userId, otherUserId);
    return { ok: true };
  }

  async clearConversationForEveryone(userId: string, otherUserId: string) {
    const result = await this.messageModel.deleteMany({
      $or: [
        { senderId: userId, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: userId },
      ],
      conversationId: null,
    });
    this.realtime.emitToUser(otherUserId, 'conversation.cleared', {
      userId,
      forEveryone: true,
    });
    return { ok: true, deletedCount: result.deletedCount ?? 0 };
  }

  async deleteMessage(userId: string, messageId: string) {
    return this.deleteMessageForEveryone(userId, messageId);
  }

  async deleteMessageForMe(userId: string, messageId: string) {
    const message = await this.messageModel.findById(messageId).lean();
    if (!message) throw new NotFoundException('Message not found');
    if (!(await this.canAccessMessage(userId, message))) {
      throw new ForbiddenException('You cannot delete this message');
    }

    await this.messageModel.updateOne(
      { _id: messageId },
      { $addToSet: { deletedFor: userId } },
    );
    return { ok: true };
  }

  async deleteMessageForEveryone(userId: string, messageId: string) {
    const message = await this.messageModel.findById(messageId).lean();
    if (!message) throw new NotFoundException('Message not found');
    if (!this.canDeleteMessageForEveryone(userId, message)) {
      throw new ForbiddenException('You can only delete your own messages for everyone');
    }

    const result = await this.messageModel.deleteOne({ _id: messageId });
    if (result.deletedCount && message) {
      await this.broadcastMessageDeleted(message, userId, String(message._id));
    }
    return { ok: true, deletedCount: result.deletedCount ?? 0 };
  }

  async unreadCount(userId: string) {
    const count = await this.messageModel.countDocuments({
      recipientId: userId,
      read: { $ne: true },
    });
    return { count };
  }

  async listDmChats(userId: string, archived = false) {
    const archivedPeerIds = await this.chatPreferences.getArchivedPeerIds(userId);
    const archivedSet = new Set(archivedPeerIds);

    const threads = await this.messageModel.aggregate<{
      _id: string;
      lastMessage: Message;
      updatedAt: Date;
    }>([
      {
        $match: {
          $or: [{ senderId: userId }, { recipientId: userId }],
          conversationId: null,
        },
      },
      {
        $addFields: {
          peerId: {
            $cond: [{ $eq: ['$senderId', userId] }, '$recipientId', '$senderId'],
          },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$peerId',
          lastMessage: { $first: '$$ROOT' },
          updatedAt: { $first: '$createdAt' },
        },
      },
      { $sort: { updatedAt: -1 } },
    ]);

    const filtered = threads.filter((thread) =>
      archived ? archivedSet.has(thread._id) : !archivedSet.has(thread._id),
    );

    const peerIds = filtered.map((thread) => thread._id);
    const [users, clearedMap] = await Promise.all([
      this.usersService.getByIds(peerIds),
      this.chatPreferences.getDmClearedAtMap(userId, peerIds),
    ]);
    const userMap = new Map(users.map((user) => [String(user._id), user]));

    const peers = filtered
      .map((thread) => {
        const clearedAt = clearedMap.get(thread._id) ?? null;
        if (
          clearedAt &&
          thread.updatedAt &&
          new Date(thread.updatedAt) <= new Date(clearedAt)
        ) {
          return null;
        }
        const user = userMap.get(thread._id);
        return {
          peerUserId: thread._id,
          displayName: user?.displayName ?? 'User',
          photoURL: user?.photoURL ?? '',
          branch: user?.branch ?? '',
          lastMessage: mediaPreviewLabel(thread.lastMessage ?? { messageType: 'text', content: '' }),
          lastMessageAt: thread.updatedAt,
          isArchived: archived,
        };
      })
      .filter((peer): peer is NonNullable<typeof peer> => peer !== null);

    return peers;
  }

  archiveDm(userId: string, peerUserId: string) {
    return this.chatPreferences.archiveDm(userId, peerUserId);
  }

  unarchiveDm(userId: string, peerUserId: string) {
    return this.chatPreferences.unarchiveDm(userId, peerUserId);
  }

  async archivedCount(userId: string) {
    return this.chatPreferences.archivedCounts(userId);
  }

  /** Mark all messages from `otherUserId` → me as read, and notify the sender. */
  async markConversationRead(userId: string, otherUserId: string) {
    const result = await this.messageModel.updateMany(
      {
        senderId: otherUserId,
        recipientId: userId,
        read: { $ne: true },
      },
      { $set: { read: true, delivered: true } },
    );
    if (result.modifiedCount) {
      this.realtime.emitToUser(otherUserId, 'messages.read', { readerId: userId });
    }
    return { ok: true, updatedCount: result.modifiedCount ?? 0 };
  }

  async toggleReaction(userId: string, messageId: string, emoji: string) {
    const message = await this.messageModel.findById(messageId).lean();
    if (!message) throw new NotFoundException('Message not found');
    if (!(await this.canAccessMessage(userId, message))) {
      throw new ForbiddenException('You cannot react to this message');
    }

    const reactions = [...(message.reactions ?? [])];
    const existingIndex = reactions.findIndex((r) => r.userId === userId);
    if (existingIndex >= 0 && reactions[existingIndex].emoji === emoji) {
      reactions.splice(existingIndex, 1);
    } else if (existingIndex >= 0) {
      reactions[existingIndex] = { userId, emoji };
    } else {
      reactions.push({ userId, emoji });
    }

    await this.messageModel.updateOne({ _id: messageId }, { $set: { reactions } });
    const updated = await this.messageModel.findById(messageId).lean();
    await this.broadcastMessageUpdate(updated);
    return updated;
  }

  async getReplyFields(userId: string, replyToId?: string) {
    if (!replyToId) return {};
    const parent = await this.messageModel.findById(replyToId).lean();
    if (!parent) throw new NotFoundException('Reply message not found');
    if (parent.messageType === 'system') {
      throw new BadRequestException('You cannot reply to this message');
    }
    if (!(await this.canAccessMessage(userId, parent))) {
      throw new ForbiddenException('You cannot reply to this message');
    }

    let senderName = 'User';
    if (parent.senderId === 'system') {
      senderName = 'System';
    } else if (parent.senderId === userId) {
      const me = await this.usersService.getById(userId);
      senderName = me?.displayName ?? 'You';
    } else {
      const sender = await this.usersService.getById(parent.senderId);
      senderName = sender?.displayName ?? 'User';
    }

    return {
      replyToId,
      replyToContent: mediaPreviewLabel(parent),
      replyToSenderId: parent.senderId,
      replyToSenderName: senderName,
    };
  }

  async deleteMessages(userId: string, messageIds: string[], forEveryone = true) {
    const messages = await this.messageModel
      .find({ _id: { $in: messageIds } })
      .lean();

    if (forEveryone) {
      const deletable = messages.filter((m) =>
        this.canDeleteMessageForEveryone(userId, m),
      );
      if (deletable.length === 0) {
        throw new ForbiddenException('No messages can be deleted for everyone');
      }

      const ids = deletable.map((m) => String(m._id));
      await this.messageModel.deleteMany({ _id: { $in: ids } });

      for (const message of deletable) {
        await this.broadcastMessageDeleted(message, userId, String(message._id));
      }

      return { ok: true, deletedCount: ids.length };
    }

    const hideable: Message[] = [];
    for (const message of messages) {
      if (await this.canAccessMessage(userId, message)) {
        hideable.push(message);
      }
    }
    if (hideable.length === 0) {
      throw new ForbiddenException('No messages can be deleted');
    }

    const ids = hideable.map((m) =>
      String((m as Message & { _id: string })._id),
    );
    await this.messageModel.updateMany(
      { _id: { $in: ids } },
      { $addToSet: { deletedFor: userId } },
    );
    return { ok: true, deletedCount: ids.length };
  }

  async forwardMessages(userId: string, payload: ForwardMessagesDto) {
    if (!payload.recipientId && !payload.conversationId) {
      throw new BadRequestException('Choose a chat to forward to');
    }

    const messages = await this.messageModel
      .find({ _id: { $in: payload.messageIds } })
      .sort({ createdAt: 1 })
      .lean();

    for (const source of messages) {
      if (!(await this.canAccessMessage(userId, source))) {
        throw new ForbiddenException('You cannot forward this message');
      }
    }

    let count = 0;
    for (const source of messages) {
      if (payload.recipientId) {
        await this.createForwardedDm(userId, payload.recipientId, source);
        count += 1;
      } else if (payload.conversationId) {
        await this.createForwardedGroupMessage(
          userId,
          payload.conversationId,
          source,
        );
        count += 1;
      }
    }

    return { ok: true, count };
  }

  private async canAccessMessage(userId: string, message: Message) {
    if (message.deletedFor?.includes(userId)) return false;
    if (message.conversationId) {
      const conversation = await this.conversationModel
        .findById(message.conversationId)
        .lean();
      if (!conversation?.participants.includes(userId)) return false;
      const clearedAt = await this.chatPreferences.getGroupClearedAt(
        userId,
        message.conversationId,
      );
      if (clearedAt && message.createdAt && new Date(message.createdAt) <= clearedAt) {
        return false;
      }
      return true;
    }
    const clearedAt = await this.chatPreferences.getDmClearedAt(
      userId,
      message.senderId === userId ? (message.recipientId as string) : message.senderId,
    );
    if (clearedAt && message.createdAt && new Date(message.createdAt) <= clearedAt) {
      return false;
    }
    return message.senderId === userId || message.recipientId === userId;
  }

  private async buildDmMessageFilter(userId: string, otherUserId: string) {
    const clearedAt = await this.chatPreferences.getDmClearedAt(userId, otherUserId);
    const filter: Record<string, unknown> = {
      $or: [
        { senderId: userId, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: userId },
      ],
      conversationId: null,
      deletedFor: { $ne: userId },
    };
    if (clearedAt) {
      filter.createdAt = { $gt: clearedAt };
    }
    return filter;
  }

  private canDeleteMessageForEveryone(userId: string, message: Message) {
    if (message.messageType === 'system') return false;
    return message.senderId === userId;
  }

  private async createForwardedDm(
    senderId: string,
    recipientId: string,
    source: Message,
  ) {
    const recipientOnline = this.realtime.isUserOnline(recipientId);
    const message = await this.messageModel.create({
      senderId,
      recipientId,
      content: source.content,
      messageType: source.messageType ?? 'text',
      attachmentId: source.attachmentId,
      attachmentMimeType: source.attachmentMimeType,
      attachmentFilename: source.attachmentFilename,
      attachmentSize: source.attachmentSize,
      delivered: recipientOnline,
      read: false,
      isForwarded: true,
    });

    const sender = await this.usersService.getById(senderId);
    await this.notificationsService.create(
      recipientId,
      senderId,
      sender?.displayName ?? 'Developer',
      'message',
    );

    const plain = message.toObject();
    this.realtime.emitToUser(recipientId, 'dm.received', plain);
    this.realtime.emitToUser(senderId, 'dm.received', plain);
    this.realtime.emitToUser(recipientId, 'notification.created');
    return message;
  }

  private async createForwardedGroupMessage(
    senderId: string,
    conversationId: string,
    source: Message,
  ) {
    const conversation = await this.conversationModel.findById(conversationId).lean();
    if (!conversation || !conversation.participants.includes(senderId)) {
      throw new ForbiddenException('You are not a member of this group');
    }

    const message = await this.messageModel.create({
      senderId,
      conversationId,
      content: source.content,
      messageType: source.messageType ?? 'text',
      attachmentId: source.attachmentId,
      attachmentMimeType: source.attachmentMimeType,
      attachmentFilename: source.attachmentFilename,
      attachmentSize: source.attachmentSize,
      readBy: [senderId],
      isForwarded: true,
    });

    await this.conversationModel.updateOne(
      { _id: conversationId },
      { $set: { updatedAt: new Date() } },
    );

    const plain = message.toObject();
    for (const participantId of conversation.participants) {
      this.realtime.emitToUser(participantId, 'group.message.received', plain);
    }
    return message;
  }

  private async broadcastMessageUpdate(message: Message | null) {
    if (!message) return;
    if (message.conversationId) {
      const conversation = await this.conversationModel
        .findById(message.conversationId)
        .lean();
      for (const participantId of conversation?.participants ?? []) {
        this.realtime.emitToUser(participantId, 'message.updated', message);
      }
      return;
    }

    if (message.recipientId) {
      this.realtime.emitToUser(message.recipientId, 'message.updated', message);
    }
    this.realtime.emitToUser(message.senderId, 'message.updated', message);
  }

  private async broadcastMessageDeleted(
    message: Message,
    actorId: string,
    messageId: string,
  ) {
    if (message.conversationId) {
      const conversation = await this.conversationModel
        .findById(message.conversationId)
        .lean();
      for (const participantId of conversation?.participants ?? []) {
        this.realtime.emitToUser(participantId, 'message.deleted', {
          messageId,
          conversationId: message.conversationId,
        });
      }
      return;
    }

    const otherId =
      message.senderId === actorId ? message.recipientId : message.senderId;
    if (otherId) {
      this.realtime.emitToUser(otherId, 'message.deleted', { messageId });
    }
  }
}
