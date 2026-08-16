import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat/chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [JwtModule.register({}), MessagesModule, NotificationsModule, UsersModule],
  providers: [ChatGateway],
})
export class WsModule {}
