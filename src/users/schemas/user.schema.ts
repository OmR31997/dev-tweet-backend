import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, minlength: 6 })
  password: string;

  @Prop({ required: true, trim: true })
  displayName: string;

  @Prop({ default: '' })
  photoURL: string;

  @Prop({ default: '' })
  bio: string;

  @Prop({ default: '' })
  college: string;

  @Prop({ default: '' })
  branch: string;

  @Prop({ default: '' })
  year: string;

  @Prop({ default: '' })
  githubUsername: string;

  @Prop({ type: [String], default: [] })
  followers: string[];

  @Prop({ type: [String], default: [] })
  following: string[];

  @Prop({ type: String, default: null })
  refreshTokenHash: string | null;

  @Prop({ type: String, default: null })
  resetPasswordTokenHash: string | null;

  @Prop({ type: Date, default: null })
  resetPasswordExpiresAt: Date | null;

  @Prop({ default: true })
  emailNotificationsEnabled: boolean;

  @Prop({ default: true })
  dailyDigestEnabled: boolean;

  @Prop({ type: Date, default: null })
  lastSeenAt?: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
