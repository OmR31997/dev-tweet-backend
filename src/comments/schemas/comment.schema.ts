import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CommentDocument = HydratedDocument<Comment>;

@Schema({ timestamps: true })
export class Comment {
  @Prop({ required: true, index: true })
  postId: string;

  @Prop({ required: true, index: true })
  authorId: string;

  @Prop({ required: true })
  authorName: string;

  @Prop({ default: '' })
  authorPhoto: string;

  @Prop({ required: true, trim: true })
  content: string;

  /** Users who liked this comment. */
  @Prop({ type: [String], default: [] })
  likes: string[];

  /** When set, this comment is a reply to another comment. */
  @Prop({ default: null, index: true })
  parentId?: string;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
CommentSchema.index({ postId: 1, createdAt: 1 });
