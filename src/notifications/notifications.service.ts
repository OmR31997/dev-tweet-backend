import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  listForUser(userId: string) {
    return this.notificationModel.find({ recipientId: userId }).sort({ createdAt: -1 }).lean();
  }

  async markRead(userId: string, id: string) {
    await this.notificationModel.updateOne({ _id: id, recipientId: userId }, { $set: { read: true } });
    return { ok: true };
  }

  async clearForUser(userId: string) {
    const result = await this.notificationModel.deleteMany({ recipientId: userId });
    return { ok: true, deletedCount: result.deletedCount ?? 0 };
  }

  create(
    recipientId: string,
    senderId: string,
    senderName: string,
    type: NotificationType,
    postId?: string,
  ) {
    return this.notificationModel.create({ recipientId, senderId, senderName, type, postId });
  }
}
