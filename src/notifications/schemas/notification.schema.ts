import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'unfollow'
  | 'follow_accept'
  | 'message'
  | 'post'
  | 'repost';

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, index: true })
  recipientId: string;

  @Prop({ required: true })
  senderId: string;

  @Prop({ required: true })
  senderName: string;

  @Prop({
    required: true,
    enum: ['like', 'comment', 'follow', 'unfollow', 'follow_accept', 'message', 'post', 'repost'],
  })
  type: NotificationType;

  @Prop({ default: null })
  postId?: string;

  @Prop({ default: false, index: true })
  read: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });
