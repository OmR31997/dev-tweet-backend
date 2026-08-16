import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ required: true, enum: ['dm', 'group'], default: 'group' })
  type: 'dm' | 'group';

  @Prop({ default: '' })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: [String], required: true, index: true })
  participants: string[];

  @Prop({ type: [String], default: [] })
  admins: string[];

  @Prop({ required: true })
  createdBy: string;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ participants: 1, updatedAt: -1 });
