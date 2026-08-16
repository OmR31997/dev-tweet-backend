import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PostDocument = HydratedDocument<Post>;

@Schema({ _id: false })
export class PostAttachment {
  @Prop({ required: true })
  fileId: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  size: number;
}

export const PostAttachmentSchema = SchemaFactory.createForClass(PostAttachment);

@Schema({ timestamps: true })
export class Post {
  @Prop({ required: true, index: true })
  authorId: string;

  @Prop({ required: true })
  authorName: string;

  @Prop({ default: '' })
  authorPhoto: string;

  @Prop({ default: '', trim: true })
  content: string;

  @Prop({ type: [String], default: [] })
  imageIds: string[];

  @Prop({ type: [PostAttachmentSchema], default: [] })
  attachments: PostAttachment[];

  @Prop({ type: [String], default: [] })
  likes: string[];

  @Prop({ default: 0 })
  commentCount: number;

  @Prop({ type: [String], default: [] })
  tags: string[];

  /** Users who have reposted this post (for toggle + count). */
  @Prop({ type: [String], default: [] })
  reposts: string[];

  /** When set, this doc is a repost of another post (shown in the feed). */
  @Prop({ default: null, index: true })
  repostOf?: string;

  @Prop({ default: null })
  repostedById?: string;

  @Prop({ default: null })
  repostedByName?: string;

  @Prop({ default: '' })
  repostedByPhoto?: string;

  /** Optional text added by the person who reposted. */
  @Prop({ default: '' })
  repostCaption?: string;
}

export const PostSchema = SchemaFactory.createForClass(Post);
PostSchema.index({ createdAt: -1 });
PostSchema.index({ repostOf: 1, repostedById: 1 });
