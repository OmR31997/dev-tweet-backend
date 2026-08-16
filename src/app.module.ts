import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UploadsModule } from './uploads/uploads.module';
import { WsModule } from './ws/ws.module';
import { EmailModule } from './email/email.module';
import { EventsModule } from './events/events.module';
import { CommentsModule } from './comments/comments.module';
import { ConversationsModule } from './conversations/conversations.module';
import { ChatPreferencesModule } from './chat-preferences/chat-preferences.module';
import { LinkPreviewModule } from './link-preview/link-preview.module';
import { validateEnv } from './config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI', 'mongodb://127.0.0.1:27017/devtweethub'),
      }),
    }),
    EventsModule,
    AuthModule,
    UsersModule,
    PostsModule,
    MessagesModule,
    ConversationsModule,
    ChatPreferencesModule,
    LinkPreviewModule,
    CommentsModule,
    NotificationsModule,
    UploadsModule,
    WsModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
