import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ChatPreferenceDocument = HydratedDocument<ChatPreference>;

@Schema({ timestamps: true })
export class ChatPreference {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, enum: ['dm', 'group'] })
  chatType!: 'dm' | 'group';

  @Prop()
  conversationId?: string;

  @Prop()
  peerUserId?: string;

  @Prop()
  archivedAt?: Date;

  @Prop()
  clearedAt?: Date;
}

export const ChatPreferenceSchema = SchemaFactory.createForClass(ChatPreference);

ChatPreferenceSchema.index(
  { userId: 1, chatType: 1, conversationId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      chatType: 'group',
      conversationId: { $type: 'string' },
    },
  },
);

ChatPreferenceSchema.index(
  { userId: 1, chatType: 1, peerUserId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      chatType: 'dm',
      peerUserId: { $type: 'string' },
    },
  },
);
