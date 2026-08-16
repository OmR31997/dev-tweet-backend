import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true, index: true })
  senderId: string;

  @Prop({ default: null, index: true })
  recipientId?: string;

  @Prop({ default: null, index: true })
  conversationId?: string;

  @Prop({ default: '' })
  content: string;

  @Prop({ default: false })
  delivered: boolean;

  @Prop({ default: false, index: true })
  read: boolean;

  @Prop({ type: [String], default: [] })
  readBy: string[];

  @Prop({
    type: [{ userId: { type: String, required: true }, emoji: { type: String, required: true } }],
    default: [],
  })
  reactions: { userId: string; emoji: string }[];

  @Prop({ default: false })
  isForwarded: boolean;

  @Prop({ default: 'text', enum: ['text', 'system', 'image', 'document'] })
  messageType: 'text' | 'system' | 'image' | 'document';

  @Prop({ default: null })
  attachmentId?: string;

  @Prop({ default: '' })
  attachmentMimeType?: string;

  @Prop({ default: '' })
  attachmentFilename?: string;

  @Prop({ default: 0 })
  attachmentSize?: number;

  @Prop({ default: null })
  replyToId?: string;

  @Prop({ default: '' })
  replyToContent?: string;

  @Prop({ default: null })
  replyToSenderId?: string;

  @Prop({ default: '' })
  replyToSenderName?: string;

  @Prop({ type: [String], default: [] })
  deletedFor: string[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ senderId: 1, recipientId: 1, createdAt: 1 });
MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ recipientId: 1, read: 1 });
