import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';
import { Message, MessageDocument } from '../messages/schemas/message.schema';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { SendGroupMessageDto } from './dto/send-group-message.dto';
import { RealtimeService } from '../events/realtime.service';
import { UsersService } from '../users/users.service';
import { MessagesService } from '../messages/messages.service';
import { buildMessageFields } from '../messages/message-media.util';
import { ChatPreferencesService } from '../chat-preferences/chat-preferences.service';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    private readonly realtime: RealtimeService,
    private readonly usersService: UsersService,
    private readonly messagesService: MessagesService,
    private readonly chatPreferences: ChatPreferencesService,
  ) {}

  async listForUser(userId: string, archived = false) {
    const archivedIds = await this.chatPreferences.getArchivedGroupIds(userId);
    const filter: Record<string, unknown> = {
      participants: userId,
      type: 'group',
    };
    if (archived) {
      if (archivedIds.length === 0) return [];
      filter._id = { $in: archivedIds };
    } else if (archivedIds.length > 0) {
      filter._id = { $nin: archivedIds };
    }
    return this.conversationModel.find(filter).sort({ updatedAt: -1 }).lean();
  }

  archiveGroup(conversationId: string, userId: string) {
    return this.getById(conversationId, userId).then(() =>
      this.chatPreferences.archiveGroup(userId, conversationId),
    );
  }

  unarchiveGroup(conversationId: string, userId: string) {
    return this.getById(conversationId, userId).then(() =>
      this.chatPreferences.unarchiveGroup(userId, conversationId),
    );
  }

  async createGroup(userId: string, payload: CreateGroupDto) {
    const participants = Array.from(
      new Set([userId, ...payload.participantIds.filter((id) => id !== userId)]),
    );
    if (participants.length < 2) {
      throw new ForbiddenException('A group needs at least two members');
    }

    const group = await this.conversationModel.create({
      type: 'group',
      title: payload.title.trim(),
      description: payload.description?.trim() ?? '',
      participants,
      admins: [userId],
      createdBy: userId,
    });

    const creator = await this.usersService.getById(userId);
    const creatorName = creator?.displayName ?? 'Someone';
    await this.createSystemMessage(
      String(group._id),
      participants,
      `${creatorName} created this group`,
    );

    for (const memberId of participants.filter((id) => id !== userId)) {
      const member = await this.usersService.getById(memberId);
      await this.createSystemMessage(
        String(group._id),
        participants,
        `${creatorName} added ${member?.displayName ?? 'a member'}`,
      );
    }

    return group;
  }

  async getById(conversationId: string, userId: string) {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .lean();
    if (!conversation) throw new NotFoundException('Group not found');
    if (!conversation.participants.includes(userId)) {
      throw new ForbiddenException('You are not a member of this group');
    }
    return conversation;
  }

  async updateGroup(
    conversationId: string,
    userId: string,
    payload: UpdateGroupDto,
  ) {
    const conversation = await this.getById(conversationId, userId);
    if (!conversation.admins.includes(userId)) {
      throw new ForbiddenException('Only group admins can edit group info');
    }

    const update: Record<string, string> = {};
    if (typeof payload.title === 'string') update.title = payload.title.trim();
    if (typeof payload.description === 'string') {
      update.description = payload.description.trim();
    }

    await this.conversationModel.updateOne(
      { _id: conversationId },
      { $set: update },
    );
    const updated = await this.conversationModel.findById(conversationId).lean();
    for (const participantId of conversation.participants) {
      this.realtime.emitToUser(participantId, 'group.updated', updated);
    }
    return updated;
  }

  async getMessages(conversationId: string, userId: string) {
    await this.getById(conversationId, userId);
    const clearedAt = await this.chatPreferences.getGroupClearedAt(
      userId,
      conversationId,
    );
    const filter: Record<string, unknown> = {
      conversationId,
      deletedFor: { $ne: userId },
    };
    if (clearedAt) {
      filter.createdAt = { $gt: clearedAt };
    }
    return this.messageModel.find(filter).sort({ createdAt: 1 }).lean();
  }

  async sendGroupMessage(
    conversationId: string,
    userId: string,
    payload: SendGroupMessageDto,
  ) {
    const conversation = await this.getById(conversationId, userId);
    const replyFields = await this.messagesService.getReplyFields(
      userId,
      payload.replyToId,
    );
    const messageFields = buildMessageFields(payload);
    const message = await this.messageModel.create({
      senderId: userId,
      conversationId,
      readBy: [userId],
      ...messageFields,
      ...replyFields,
    });

    await this.conversationModel.updateOne(
      { _id: conversationId },
      { $set: { updatedAt: new Date() } },
    );

    for (const participantId of conversation.participants) {
      await this.chatPreferences.unarchiveGroup(participantId, conversationId);
    }

    const plain = message.toObject();
    for (const participantId of conversation.participants) {
      this.realtime.emitToUser(participantId, 'group.message.received', plain);
    }
    return message;
  }

  async markGroupRead(conversationId: string, userId: string) {
    const conversation = await this.getById(conversationId, userId);
    await this.messageModel.updateMany(
      {
        conversationId,
        senderId: { $ne: userId },
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } },
    );
    for (const participantId of conversation.participants) {
      this.realtime.emitToUser(participantId, 'group.messages.read', {
        conversationId,
      });
    }
    return { ok: true };
  }

  async clearGroupChat(conversationId: string, userId: string) {
    await this.getById(conversationId, userId);
    await this.chatPreferences.clearGroupChat(userId, conversationId);
    return { ok: true };
  }

  async clearGroupChatForEveryone(conversationId: string, userId: string) {
    const conversation = await this.getById(conversationId, userId);
    if (!conversation.admins.includes(userId)) {
      throw new ForbiddenException('Only group admins can delete chat for everyone');
    }
    const result = await this.messageModel.deleteMany({ conversationId });
    for (const participantId of conversation.participants) {
      this.realtime.emitToUser(participantId, 'group.cleared', {
        conversationId,
        userId,
        forEveryone: true,
      });
    }
    return { ok: true, deletedCount: result.deletedCount ?? 0 };
  }

  async addParticipant(
    conversationId: string,
    actorId: string,
    targetUserId: string,
  ) {
    const conversation = await this.getById(conversationId, actorId);
    if (!conversation.admins.includes(actorId)) {
      throw new ForbiddenException('Only group admins can manage members');
    }
    if (conversation.participants.includes(targetUserId)) {
      throw new ForbiddenException('User is already in this group');
    }

    const target = await this.usersService.getById(targetUserId);
    if (!target) {
      throw new NotFoundException('User not found');
    }

    await this.conversationModel.updateOne(
      { _id: conversationId },
      { $addToSet: { participants: targetUserId } },
    );

    const updated = await this.conversationModel.findById(conversationId).lean();
    if (!updated) throw new NotFoundException('Group not found');

    const actor = await this.usersService.getById(actorId);
    await this.createSystemMessage(
      conversationId,
      updated.participants,
      `${actor?.displayName ?? 'Admin'} added ${target.displayName ?? 'a member'}`,
    );

    await this.chatPreferences.unarchiveGroup(targetUserId, conversationId);

    for (const participantId of updated.participants) {
      this.realtime.emitToUser(participantId, 'group.updated', updated);
    }
    return updated;
  }

  async promoteAdmin(conversationId: string, actorId: string, targetUserId: string) {
    const conversation = await this.getById(conversationId, actorId);
    if (!conversation.admins.includes(actorId)) {
      throw new ForbiddenException('Only group admins can manage members');
    }
    if (!conversation.participants.includes(targetUserId)) {
      throw new NotFoundException('Member not found in this group');
    }

    await this.conversationModel.updateOne(
      { _id: conversationId },
      { $addToSet: { admins: targetUserId } },
    );
    return this.broadcastGroupUpdate(conversationId, conversation.participants);
  }

  async demoteAdmin(conversationId: string, actorId: string, targetUserId: string) {
    const conversation = await this.getById(conversationId, actorId);
    if (!conversation.admins.includes(actorId)) {
      throw new ForbiddenException('Only group admins can manage members');
    }
    if (!conversation.admins.includes(targetUserId)) {
      throw new NotFoundException('Member is not an admin');
    }
    if (conversation.admins.length <= 1) {
      throw new ForbiddenException('Group must have at least one admin');
    }

    await this.conversationModel.updateOne(
      { _id: conversationId },
      { $pull: { admins: targetUserId } },
    );
    return this.broadcastGroupUpdate(conversationId, conversation.participants);
  }

  async removeParticipant(
    conversationId: string,
    actorId: string,
    targetUserId: string,
  ) {
    const conversation = await this.getById(conversationId, actorId);
    if (!conversation.admins.includes(actorId)) {
      throw new ForbiddenException('Only group admins can manage members');
    }
    if (targetUserId === actorId) {
      throw new ForbiddenException('You cannot remove yourself from the group');
    }
    if (!conversation.participants.includes(targetUserId)) {
      throw new NotFoundException('Member not found in this group');
    }
    if (conversation.participants.length <= 2) {
      throw new ForbiddenException('Group must have at least two members');
    }

    await this.conversationModel.updateOne(
      { _id: conversationId },
      {
        $pull: {
          participants: targetUserId,
          admins: targetUserId,
        },
      },
    );

    const actor = await this.usersService.getById(actorId);
    const target = await this.usersService.getById(targetUserId);
    const remaining = conversation.participants.filter((id) => id !== targetUserId);
    await this.createSystemMessage(
      conversationId,
      remaining,
      `${actor?.displayName ?? 'Admin'} removed ${target?.displayName ?? 'a member'}`,
    );

    return this.broadcastGroupUpdate(conversationId, remaining, targetUserId);
  }

  private async createSystemMessage(
    conversationId: string,
    participants: string[],
    content: string,
  ) {
    const message = await this.messageModel.create({
      senderId: 'system',
      conversationId,
      content,
      messageType: 'system',
      readBy: participants,
    });

    await this.conversationModel.updateOne(
      { _id: conversationId },
      { $set: { updatedAt: new Date() } },
    );

    const plain = message.toObject();
    for (const participantId of participants) {
      this.realtime.emitToUser(participantId, 'group.message.received', plain);
    }
    return message;
  }

  private async broadcastGroupUpdate(
    conversationId: string,
    participants: string[],
    removedUserId?: string,
  ) {
    const updated = await this.conversationModel.findById(conversationId).lean();
    for (const participantId of participants) {
      this.realtime.emitToUser(participantId, 'group.updated', updated);
    }
    if (removedUserId) {
      this.realtime.emitToUser(removedUserId, 'group.removed', { conversationId });
    }
    return updated;
  }
}
