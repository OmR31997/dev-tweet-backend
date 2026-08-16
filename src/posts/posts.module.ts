import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Post, PostSchema } from './schemas/post.schema';
import { UsersModule } from '../users/users.module';
import { UploadsModule } from '../uploads/uploads.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]), UsersModule, UploadsModule, NotificationsModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
